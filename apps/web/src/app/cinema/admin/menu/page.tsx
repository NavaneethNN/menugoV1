'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { apiRequest, getApiBaseUrl } from '@/lib/api';
import { formatPaise, rupeesToPaise, paiseToRupees, CINEMA_FOOD_CATEGORIES } from '@menugo/shared';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Leaf,
  Beef,
  Upload,
  Check,
  Package,
  Coffee,
  IceCream,
  Popcorn,
  ChevronRight,
  RefreshCw,
  FolderPlus
} from 'lucide-react';

interface Category {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  restaurantId: string;
  categoryId: string | null;
  categoryName?: string | null;
  name: string;
  description: string | null;
  price: number; // in integer paise
  imageKey: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isVegetarian: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function CinemaMenuPage() {
  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreName, setTheatreName] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');

  // Modals
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [editProductModalOpen, setEditProductModalOpen] = useState(false);
  const [deleteProductModalOpen, setDeleteProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [editCategoryModalOpen, setEditCategoryModalOpen] = useState(false);
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Product Form State
  const [productForm, setProductForm] = useState({
    name: '',
    categoryId: '',
    priceRupees: '',
    description: '',
    imageUrl: '',
    imageKey: null as string | null,
    isVegetarian: true,
    isAvailable: true
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category Form State
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    isActive: true
  });

  const [submitting, setSubmitting] = useState(false);
  const [seedingCategories, setSeedingCategories] = useState(false);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    loadTheatreAndMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTheatreAndMenu = async () => {
    try {
      setLoading(true);
      setError(null);

      // Find user's cinema theatre
      const myMemberships = await apiRequest('/api/restaurants/my');
      const cinemaMembership = myMemberships.find(
        (m: any) => m.restaurant?.tenantType === 'cinema'
      );

      if (!cinemaMembership || !cinemaMembership.restaurant) {
        throw new Error('No cinema theatre found for the authenticated account');
      }

      const tId = cinemaMembership.restaurant.id;
      setTheatreId(tId);
      setTheatreName(cinemaMembership.restaurant.name);
      setCurrency(cinemaMembership.restaurant.currency || 'INR');

      await fetchMenuData(tId);
    } catch (err: any) {
      console.error('Failed to load cinema food menu:', err);
      setError(err?.message || 'Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuData = async (tId: string) => {
    try {
      const [cats, prods] = await Promise.all([
        apiRequest<Category[]>('/api/categories', { restaurantId: tId }),
        apiRequest<Product[]>('/api/products', { restaurantId: tId })
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
    } catch (err: any) {
      console.error('Failed to fetch categories & products:', err);
      setError(err?.message || 'Failed to fetch categories or products');
    }
  };

  // Seed default recommended cinema categories
  const handleSeedCategories = async () => {
    if (!theatreId) return;
    try {
      setSeedingCategories(true);
      setError(null);

      const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
      let createdCount = 0;

      for (let i = 0; i < CINEMA_FOOD_CATEGORIES.length; i++) {
        const catName = CINEMA_FOOD_CATEGORIES[i];
        if (catName && !existingNames.has(catName.toLowerCase())) {
          await apiRequest('/api/categories', {
            method: 'POST',
            restaurantId: theatreId,
            body: JSON.stringify({
              name: catName,
              description: `Cinema concession ${catName.toLowerCase()}`,
              sortOrder: i + 1,
              isActive: true
            })
          });
          createdCount++;
        }
      }

      setSuccess(`Added ${createdCount} recommended cinema categories!`);
      await fetchMenuData(theatreId);
    } catch (err: any) {
      console.error('Failed to seed categories:', err);
      setError(err?.message || 'Failed to add recommended categories');
    } finally {
      setSeedingCategories(false);
    }
  };

  // Quick toggle product availability
  const handleToggleProductAvailability = async (product: Product) => {
    if (!theatreId) return;
    const newStatus = !product.isAvailable;
    const previousProducts = [...products];

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isAvailable: newStatus } : p))
    );

    try {
      await apiRequest(`/api/products/${product.id}/availability`, {
        method: 'PATCH',
        restaurantId: theatreId,
        body: JSON.stringify({ isAvailable: newStatus })
      });
      setSuccess(`"${product.name}" marked as ${newStatus ? 'In Stock / Available' : 'Sold Out / Unavailable'}`);
    } catch (err: any) {
      // Revert optimistic update
      setProducts(previousProducts);
      setError(err?.message || 'Failed to update product availability');
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !theatreId) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (PNG, JPG, WEBP)');
      return;
    }

    try {
      setUploadingImage(true);
      setUploadError(null);

      // Attempt backend direct upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'products');

      const directRes = await fetch(`${getApiBaseUrl()}/api/uploads/direct`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-restaurant-id': theatreId
        },
        body: formData
      });

      if (directRes.ok) {
        const data = await directRes.json();
        setProductForm((prev) => ({
          ...prev,
          imageKey: data.objectKey || null,
          imageUrl: data.publicUrl || ''
        }));
      } else {
        // Fallback to client-side data URL preview
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setProductForm((prev) => ({
            ...prev,
            imageKey: null,
            imageUrl: dataUrl
          }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error('Image upload failed, falling back to base64 preview:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setProductForm((prev) => ({
          ...prev,
          imageKey: null,
          imageUrl: dataUrl
        }));
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Product Modals
  const openAddProductModal = () => {
    setProductForm({
      name: '',
      categoryId: categories.length > 0 ? categories[0]!.id : '',
      priceRupees: '',
      description: '',
      imageUrl: '',
      imageKey: null,
      isVegetarian: true,
      isAvailable: true
    });
    setUploadError(null);
    setAddProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setSelectedProduct(product);
    setProductForm({
      name: product.name,
      categoryId: product.categoryId || '',
      priceRupees: paiseToRupees(product.price).toString(),
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      imageKey: product.imageKey || null,
      isVegetarian: product.isVegetarian,
      isAvailable: product.isAvailable
    });
    setUploadError(null);
    setEditProductModalOpen(true);
  };

  const openDeleteProductModal = (product: Product) => {
    setSelectedProduct(product);
    setDeleteProductModalOpen(true);
  };

  // Category Modals
  const openAddCategoryModal = () => {
    setCategoryForm({
      name: '',
      description: '',
      isActive: true
    });
    setAddCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setSelectedCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      isActive: cat.isActive
    });
    setEditCategoryModalOpen(true);
  };

  const openDeleteCategoryModal = (cat: Category) => {
    setSelectedCategory(cat);
    setDeleteCategoryModalOpen(true);
  };

  // Product Submit Handlers
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId) return;

    if (!productForm.name.trim()) {
      setError('Product name is required');
      return;
    }

    const priceNum = parseFloat(productForm.priceRupees);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid non-negative price in rupees (e.g. 180)');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const pricePaise = rupeesToPaise(priceNum);
      const payload: any = {
        name: productForm.name.trim(),
        categoryId: productForm.categoryId ? productForm.categoryId : null,
        price: pricePaise,
        description: productForm.description.trim() || null,
        imageUrl: productForm.imageUrl.trim() || null,
        imageKey: productForm.imageKey || null,
        isVegetarian: productForm.isVegetarian,
        isAvailable: productForm.isAvailable
      };

      if (selectedProduct) {
        // Edit product
        await apiRequest(`/api/products/${selectedProduct.id}`, {
          method: 'PATCH',
          restaurantId: theatreId,
          body: JSON.stringify(payload)
        });
        setSuccess(`Product "${productForm.name}" updated successfully!`);
        setEditProductModalOpen(false);
      } else {
        // Create product
        await apiRequest('/api/products', {
          method: 'POST',
          restaurantId: theatreId,
          body: JSON.stringify(payload)
        });
        setSuccess(`Product "${productForm.name}" added to cinema menu!`);
        setAddProductModalOpen(false);
      }

      await fetchMenuData(theatreId);
    } catch (err: any) {
      console.error('Failed to save product:', err);
      setError(err?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!theatreId || !selectedProduct) return;
    try {
      setSubmitting(true);
      setError(null);

      await apiRequest(`/api/products/${selectedProduct.id}`, {
        method: 'DELETE',
        restaurantId: theatreId
      });

      setSuccess(`Product "${selectedProduct.name}" removed from cinema menu`);
      setDeleteProductModalOpen(false);
      await fetchMenuData(theatreId);
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      setError(err?.message || 'Failed to delete product');
    } finally {
      setSubmitting(false);
    }
  };

  // Category Submit Handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId) return;

    if (!categoryForm.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null,
        isActive: categoryForm.isActive
      };

      if (selectedCategory) {
        await apiRequest(`/api/categories/${selectedCategory.id}`, {
          method: 'PATCH',
          restaurantId: theatreId,
          body: JSON.stringify(payload)
        });
        setSuccess(`Category "${categoryForm.name}" updated!`);
        setEditCategoryModalOpen(false);
      } else {
        await apiRequest('/api/categories', {
          method: 'POST',
          restaurantId: theatreId,
          body: JSON.stringify({
            ...payload,
            sortOrder: categories.length + 1
          })
        });
        setSuccess(`Category "${categoryForm.name}" created!`);
        setAddCategoryModalOpen(false);
      }

      await fetchMenuData(theatreId);
    } catch (err: any) {
      console.error('Failed to save category:', err);
      setError(err?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!theatreId || !selectedCategory) return;
    try {
      setSubmitting(true);
      setError(null);

      await apiRequest(`/api/categories/${selectedCategory.id}`, {
        method: 'DELETE',
        restaurantId: theatreId
      });

      setSuccess(`Category "${selectedCategory.name}" deleted`);
      setDeleteCategoryModalOpen(false);
      await fetchMenuData(theatreId);
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      setError(err?.message || 'Failed to delete category (ensure no products are attached)');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && p.categoryId !== selectedCategoryFilter) {
        return false;
      }
      // Vegetarian filter
      if (vegFilter === 'VEG' && !p.isVegetarian) return false;
      if (vegFilter === 'NON_VEG' && p.isVegetarian) return false;
      // Availability filter
      if (availabilityFilter === 'AVAILABLE' && !p.isAvailable) return false;
      if (availabilityFilter === 'UNAVAILABLE' && p.isAvailable) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, selectedCategoryFilter, vegFilter, availabilityFilter, searchQuery]);

  // Quick stats
  const totalItemsCount = products.length;
  const availableItemsCount = products.filter((p) => p.isAvailable).length;
  const combosCount = products.filter((p) => {
    const isComboCat = p.categoryName?.toLowerCase().includes('combo');
    const isComboName = p.name.toLowerCase().includes('combo') || p.name.includes('+');
    return isComboCat || isComboName;
  }).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading Cinema Concessions Menu...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Cinema Food Menu</h1>
              <p className="text-xs text-slate-400 font-medium">
                {theatreName} • Concessions, Popcorn, Combos & In-Seat Ordering Catalogue
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {categories.length === 0 && (
            <button
              onClick={handleSeedCategories}
              disabled={seedingCategories}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition"
            >
              {seedingCategories ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Add Recommended Categories
            </button>
          )}

          <button
            onClick={openAddCategoryModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            Add Category
          </button>

          <button
            onClick={openAddProductModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Products</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalItemsCount}</span>
            <span className="text-xs text-slate-400">items</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">In Stock & Active</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{availableItemsCount}</span>
            <span className="text-xs text-slate-400">of {totalItemsCount} items</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Categories</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-400">{categories.length}</span>
            <span className="text-xs text-slate-400">configured</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Combo Packages</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-violet-400">{combosCount}</span>
            <span className="text-xs text-slate-400">special combos</span>
          </div>
        </div>
      </div>

      {/* Category Navigation Pills */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Categories
          </h2>
          {categories.length > 0 && (
            <button
              onClick={openAddCategoryModal}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              + New Category
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedCategoryFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            All Products ({products.length})
          </button>

          {categories.map((cat) => {
            const countForCat = products.filter((p) => p.categoryId === cat.id).length;
            const isSelected = selectedCategoryFilter === cat.id;

            return (
              <div
                key={cat.id}
                className={`group inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <button
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className="flex items-center gap-1.5"
                >
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {countForCat}
                  </span>
                </button>
                <button
                  onClick={() => openEditCategoryModal(cat)}
                  title="Edit Category"
                  className={`opacity-0 group-hover:opacity-100 hover:scale-110 transition ml-1 ${isSelected ? 'text-indigo-200 hover:text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search concessions or combos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Vegetarian Filter */}
          <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-0.5">
            <button
              onClick={() => setVegFilter('ALL')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                vegFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Diet
            </button>
            <button
              onClick={() => setVegFilter('VEG')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition flex items-center gap-1 ${
                vegFilter === 'VEG' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <Leaf className="w-3 h-3 text-emerald-400" />
              Veg
            </button>
            <button
              onClick={() => setVegFilter('NON_VEG')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition flex items-center gap-1 ${
                vegFilter === 'NON_VEG' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <Beef className="w-3 h-3 text-rose-400" />
              Non-Veg
            </button>
          </div>

          {/* Availability Filter */}
          <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-0.5">
            <button
              onClick={() => setAvailabilityFilter('ALL')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                availabilityFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Stock
            </button>
            <button
              onClick={() => setAvailabilityFilter('AVAILABLE')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                availabilityFilter === 'AVAILABLE' ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-400 hover:text-indigo-400'
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setAvailabilityFilter('UNAVAILABLE')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                availabilityFilter === 'UNAVAILABLE' ? 'bg-amber-600/30 text-amber-300' : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              Sold Out
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-4">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">No Food Products Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            {products.length === 0
              ? 'Your cinema concessions menu is empty. Add categories and food items to enable in-auditorium seat ordering.'
              : 'No products match the selected filters. Try adjusting search or category filters.'}
          </p>
          <div className="flex gap-3">
            {categories.length === 0 && (
              <button
                onClick={handleSeedCategories}
                disabled={seedingCategories}
                className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Add Popcorn & Combos Categories
              </button>
            )}
            <button
              onClick={openAddProductModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Food Item
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const isCombo =
              product.categoryName?.toLowerCase().includes('combo') ||
              product.name.toLowerCase().includes('combo') ||
              product.name.includes('+');

            return (
              <div
                key={product.id}
                className={`group rounded-2xl bg-slate-900 border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  product.isAvailable
                    ? 'border-slate-800 hover:border-slate-700 hover:shadow-xl hover:shadow-black/40'
                    : 'border-slate-800/60 opacity-75 bg-slate-900/60'
                }`}
              >
                {/* Product Card Top: Image & Badges */}
                <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden border-b border-slate-800">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                      <UtensilsCrossed className="w-10 h-10 mb-1" />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        {product.categoryName || 'Concession'}
                      </span>
                    </div>
                  )}

                  {/* Dietary Badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-md ${
                        product.isVegetarian
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                          : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                      }`}
                    >
                      {product.isVegetarian ? (
                        <>
                          <Leaf className="w-2.5 h-2.5" /> Veg
                        </>
                      ) : (
                        <>
                          <Beef className="w-2.5 h-2.5" /> Non-Veg
                        </>
                      )}
                    </span>

                    {isCombo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-950/80 text-violet-300 border border-violet-500/40 backdrop-blur-md">
                        <Sparkles className="w-2.5 h-2.5" /> Combo
                      </span>
                    )}
                  </div>

                  {/* Stock Availability Pill */}
                  <div className="absolute top-2.5 right-2.5">
                    <button
                      onClick={() => handleToggleProductAvailability(product)}
                      title={product.isAvailable ? 'Click to mark as Sold Out' : 'Click to mark as In Stock'}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-md transition ${
                        product.isAvailable
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/90'
                          : 'bg-amber-950/80 text-amber-400 border-amber-500/40 hover:bg-amber-900/90'
                      }`}
                    >
                      {product.isAvailable ? 'In Stock' : 'Sold Out'}
                    </button>
                  </div>
                </div>

                {/* Product Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    {product.categoryName && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                        {product.categoryName}
                      </p>
                    )}
                    <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-indigo-300 transition">
                      {product.name}
                    </h4>
                    {product.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Price and Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400">Price: </span>
                      <span className="text-base font-black text-white">
                        {formatPaise(product.price, currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditProductModal(product)}
                        title="Edit Item"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteProductModal(product)}
                        title="Delete Item"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* ADD / EDIT PRODUCT MODAL */}
      {(addProductModalOpen || editProductModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 text-white shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editProductModalOpen ? 'Edit Food Product' : 'Add Food Product'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Concessions, Popcorn, Combos or Beverages
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAddProductModalOpen(false);
                  setEditProductModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Large Butter Popcorn or Popcorn + Coke Combo"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Category & Price in INR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Price (₹ Rupees) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 180.00"
                    value={productForm.priceRupees}
                    onChange={(e) => setProductForm({ ...productForm, priceRupees: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Stored in integer paise in database
                  </span>
                </div>
              </div>

              {/* Description / Combo Breakdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Combo Items
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 1x Large Golden Popcorn with extra butter and 1x 500ml Fountain Soda"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              {/* Image Upload / Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Image
                </label>
                <div className="flex items-center gap-3">
                  {productForm.imageUrl ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={productForm.imageUrl}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, imageUrl: '', imageKey: null })}
                        className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 flex items-center justify-center text-slate-500 shrink-0">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          Choose Image
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500">
                      JPEG, PNG, or WebP. Max 5MB recommended.
                    </p>
                  </div>
                </div>
                {uploadError && (
                  <p className="text-[11px] text-rose-400 mt-1">{uploadError}</p>
                )}
              </div>

              {/* Toggles: Vegetarian & Available */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isVegetarian}
                    onChange={(e) => setProductForm({ ...productForm, isVegetarian: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Vegetarian</span>
                    <span className="text-[10px] text-slate-500">Pure veg item</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isAvailable}
                    onChange={(e) => setProductForm({ ...productForm, isAvailable: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">In Stock</span>
                    <span className="text-[10px] text-slate-500">Available to order</span>
                  </div>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAddProductModalOpen(false);
                    setEditProductModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editProductModalOpen ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT CATEGORY MODAL */}
      {(addCategoryModalOpen || editCategoryModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editCategoryModalOpen ? 'Edit Category' : 'New Category'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Organize cinema concessions & beverages
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAddCategoryModalOpen(false);
                  setEditCategoryModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Popcorn, Beverages, Combos"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Fresh hot popped corn with various seasoning options"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Active Category</span>
                  <span className="text-[10px] text-slate-500">Visible in ordering menus</span>
                </div>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                {editCategoryModalOpen && selectedCategory ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditCategoryModalOpen(false);
                      openDeleteCategoryModal(selectedCategory);
                    }}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
                  >
                    Delete Category
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddCategoryModalOpen(false);
                      setEditCategoryModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editCategoryModalOpen ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PRODUCT MODAL */}
      {deleteProductModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Remove Product?</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to delete &ldquo;{selectedProduct.name}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              This will remove this item from your cinema concessions catalogue and make it unavailable for in-seat ordering.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteProductModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteProduct}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY MODAL */}
      {deleteCategoryModalOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Category?</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to delete &ldquo;{selectedCategory.name}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              Categories with existing products cannot be deleted. Ensure all products under this category are reassigned or removed first.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteCategory}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
