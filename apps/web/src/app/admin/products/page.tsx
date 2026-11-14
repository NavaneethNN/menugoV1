'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { apiRequest, getApiBaseUrl } from '@/lib/api';
import {
  UtensilsCrossed,
  Plus,
  ArrowLeft,
  MoveUp,
  MoveDown,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Store,
  Layers,
  ShieldCheck,
  LogOut,
  X,
  Search,
  Filter,
  IndianRupee,
  Leaf,
  Beef,
  Image as ImageIcon,
  Check,
  ToggleLeft,
  ToggleRight,
  Upload,
  UploadCloud
} from 'lucide-react';
import Link from 'next/link';
import { formatPaise, rupeesToPaise, paiseToRupees } from '@menugo/shared';

interface Category {
  id: string;
  name: string;
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

export default function AdminProductsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);
  const initialMenuLoadedRef = useRef(false);

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPriceRupees, setFormPriceRupees] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageKey, setFormImageKey] = useState<string | null>(null);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsVegetarian, setFormIsVegetarian] = useState(true);
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRestaurant = selectedMembership?.restaurant;
  const currentRole = selectedMembership?.role;
  const canManage = currentRole === 'owner' || currentRole === 'admin';

  // Load user's restaurants
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionLoading, router]);

  const loadInitialData = async (isSilent = false) => {
    try {
      if (!isSilent && restaurants.length === 0) {
        setLoading(true);
      }
      const data = await apiRequest('/api/restaurants/my');
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedMembership((prev: any) => {
          if (!prev) return data[0];
          const match = data.find((r: any) => r.restaurant.id === prev.restaurant?.id);
          return match || data[0];
        });
      } else {
        setSelectedMembership(null);
      }
    } catch (err: any) {
      console.error('Failed to load restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load categories and products when active restaurant changes
  const loadMenuData = useCallback(async (isSilent = false) => {
    if (!selectedRestaurant?.id) return;
    try {
      if (!isSilent && !initialMenuLoadedRef.current) {
        setLoading(true);
      }
      setServerError(null);

      const [cats, prods] = await Promise.all([
        apiRequest<Category[]>('/api/categories', {
          restaurantId: selectedRestaurant.id
        }),
        apiRequest<Product[]>('/api/products', {
          restaurantId: selectedRestaurant.id
        })
      ]);

      initialMenuLoadedRef.current = true;
      setCategories(cats);
      setProducts(prods);
    } catch (err: any) {
      setServerError(err.message || 'Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurant?.id]);

  useEffect(() => {
    if (selectedRestaurant?.id) {
      loadMenuData();
    }
  }, [selectedRestaurant?.id, loadMenuData]);

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormCategoryId('');
    setFormPriceRupees('');
    setFormDescription('');
    setFormImageKey(null);
    setFormImageUrl('');
    setFormIsVegetarian(true);
    setFormIsAvailable(true);
    setUploadingImage(false);
    setUploadError(null);
    setFieldErrors({});
    setServerError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Open modal for editing
  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategoryId(product.categoryId || '');
    setFormPriceRupees(paiseToRupees(product.price).toString());
    setFormDescription(product.description || '');
    setFormImageKey(product.imageKey || null);
    setFormImageUrl(product.imageUrl || '');
    setFormIsVegetarian(product.isVegetarian);
    setFormIsAvailable(product.isAvailable);
    setUploadingImage(false);
    setUploadError(null);
    setFieldErrors({});
    setServerError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle image file selection with presigned PUT upload & fallback
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRestaurant?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size cannot exceed 5 MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Allowed image formats: JPG, PNG, WebP, GIF, AVIF');
      return;
    }

    try {
      setUploadingImage(true);
      setUploadError(null);

      let uploadedKey = '';
      let uploadedUrl = '';

      // 1. Attempt presigned PUT URL upload
      try {
        const presigned = await apiRequest<{
          uploadUrl: string;
          objectKey: string;
          publicUrl: string;
          headers: Record<string, string>;
        }>('/api/uploads/presigned-url', {
          method: 'POST',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({
            fileType: file.type,
            fileSize: file.size,
            purpose: 'products',
            fileName: file.name
          })
        });

        const putRes = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: presigned.headers,
          body: file
        });

        if (!putRes.ok) {
          throw new Error(`R2 presigned upload failed with status ${putRes.status}`);
        }

        uploadedKey = presigned.objectKey;
        uploadedUrl = presigned.publicUrl;
      } catch (presignedErr) {
        // 2. Graceful fallback to backend direct multipart streaming upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'products');

        const directRes = await fetch(
          `${getApiBaseUrl()}/api/uploads/direct`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'x-restaurant-id': selectedRestaurant.id
            },
            body: formData
          }
        );

        if (!directRes.ok) {
          const errData = await directRes.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || 'Direct upload failed');
        }

        const directData = await directRes.json();
        uploadedKey = directData.objectKey;
        uploadedUrl = directData.publicUrl;
      }

      setFormImageKey(uploadedKey);
      setFormImageUrl(uploadedUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Quick toggle availability (allowed for kitchen, staff, owner, admin)
  const handleToggleAvailability = async (product: Product) => {
    const updatedStatus = !product.isAvailable;
    const oldProducts = [...products];

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isAvailable: updatedStatus } : p))
    );

    try {
      await apiRequest(`/api/products/${product.id}/availability`, {
        method: 'PATCH',
        restaurantId: selectedRestaurant?.id,
        body: JSON.stringify({ isAvailable: updatedStatus })
      });
      setSuccessMessage(`Product "${product.name}" marked as ${updatedStatus ? 'In Stock' : 'Sold Out'}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      // Revert optimistic update
      setProducts(oldProducts);
      setServerError(err.message || 'Failed to update product availability');
    }
  };

  // Form submission (Create or Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const errors: Record<string, string> = {};
    if (!formName.trim()) {
      errors.name = 'Product name is required';
    } else if (formName.trim().length > 255) {
      errors.name = 'Product name cannot exceed 255 characters';
    }

    const priceNum = parseFloat(formPriceRupees);
    if (isNaN(priceNum) || priceNum < 0) {
      errors.price = 'Please enter a valid non-negative price in rupees (e.g. 150.00)';
    }

    if (formDescription && formDescription.length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters';
    }

    if (formImageUrl && formImageUrl.trim()) {
      try {
        new URL(formImageUrl.trim());
      } catch {
        errors.imageUrl = 'Please enter a valid URL (e.g. https://...)';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const pricePaise = rupeesToPaise(priceNum);

      const payload = {
        name: formName.trim(),
        categoryId: formCategoryId ? formCategoryId : null,
        price: pricePaise,
        description: formDescription.trim() || null,
        imageKey: formImageKey || null,
        imageUrl: formImageUrl.trim() || null,
        isVegetarian: formIsVegetarian,
        isAvailable: formIsAvailable
      };

      if (editingProduct) {
        // Update product
        const updated = await apiRequest(`/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify(payload)
        });

        const matchingCat = categories.find((c) => c.id === updated.categoryId);
        const enriched = {
          ...updated,
          categoryName: matchingCat ? matchingCat.name : null
        };

        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? enriched : p)));
        setSuccessMessage(`Product "${updated.name}" updated successfully`);
        setEditingProduct(null);
      } else {
        // Create product
        const created = await apiRequest('/api/products', {
          method: 'POST',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({
            ...payload,
            sortOrder: products.length > 0 ? Math.max(...products.map((p) => p.sortOrder)) + 1 : 0
          })
        });

        const matchingCat = categories.find((c) => c.id === created.categoryId);
        const enriched = {
          ...created,
          categoryName: matchingCat ? matchingCat.name : null
        };

        setProducts((prev) => [...prev, enriched]);
        setSuccessMessage(`Product "${created.name}" created successfully`);
        setShowAddModal(false);
      }

      resetForm();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setServerError(err.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  // Reorder product up/down
  const handleMoveProduct = async (index: number, direction: 'up' | 'down') => {
    if (!canManage) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredProducts.length) return;

    const currentItem = filteredProducts[index];
    const targetItem = filteredProducts[targetIndex];
    if (!currentItem || !targetItem) return;

    // Create reordered clone
    const updatedList = [...products];
    const curIdx = updatedList.findIndex((p) => p.id === currentItem.id);
    const tarIdx = updatedList.findIndex((p) => p.id === targetItem.id);

    if (curIdx === -1 || tarIdx === -1) return;

    const temp = updatedList[curIdx]!;
    updatedList[curIdx] = updatedList[tarIdx]!;
    updatedList[tarIdx] = temp;

    // Re-assign sortOrder
    const reordered = updatedList.map((p, idx) => ({
      ...p,
      sortOrder: idx
    }));

    setProducts(reordered);

    try {
      await apiRequest('/api/products/reorder', {
        method: 'PUT',
        restaurantId: selectedRestaurant.id,
        body: JSON.stringify({
          items: reordered.map((p) => ({ id: p.id, sortOrder: p.sortOrder }))
        })
      });
    } catch (err: any) {
      setServerError(err.message || 'Failed to update reorder on server');
      loadMenuData();
    }
  };

  // Delete product confirmation
  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      setSubmitting(true);
      await apiRequest(`/api/products/${deletingProduct.id}`, {
        method: 'DELETE',
        restaurantId: selectedRestaurant.id
      });

      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      setSuccessMessage(`Product "${deletingProduct.name}" deleted successfully`);
      setDeletingProduct(null);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setServerError(err.message || 'Failed to delete product');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products by category, search, and availability
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL') {
        if (selectedCategoryFilter === 'UNCATEGORIZED') {
          if (p.categoryId) return false;
        } else if (p.categoryId !== selectedCategoryFilter) {
          return false;
        }
      }

      // Availability filter
      if (availabilityFilter === 'AVAILABLE' && !p.isAvailable) return false;
      if (availabilityFilter === 'UNAVAILABLE' && p.isAvailable) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(query);
        const descMatch = p.description?.toLowerCase().includes(query);
        const catMatch = p.categoryName?.toLowerCase().includes(query);
        if (!nameMatch && !descMatch && !catMatch) return false;
      }

      return true;
    });
  }, [products, selectedCategoryFilter, availabilityFilter, searchQuery]);

  if ((sessionLoading || (loading && !selectedRestaurant)) && !initialLoadedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white font-bold flex items-center justify-center">
              M
            </div>
            <span className="font-extrabold text-xl text-slate-900 hidden sm:inline">
              Menu<span className="text-orange-600">Go</span> Admin
            </span>
          </Link>

          {/* Restaurant switcher */}
          {restaurants.length > 0 && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <Store className="w-4 h-4 text-slate-400" />
              <select
                value={selectedRestaurant?.id || ''}
                onChange={(e) => {
                  const match = restaurants.find((r) => r.restaurant.id === e.target.value);
                  if (match) setSelectedMembership(match);
                }}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                {restaurants.map((m) => (
                  <option key={m.restaurant.id} value={m.restaurant.id}>
                    {m.restaurant.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              {currentRole}
            </span>
            <span className="text-sm font-medium text-slate-600 hidden md:inline">
              {session?.user.email}
            </span>
          </div>

          <button
            onClick={() => signOut().then(() => router.push('/admin/login'))}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-red-50 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Breadcrumb & Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/admin/dashboard"
                className="hover:text-orange-600 flex items-center gap-1 font-medium transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-900 font-semibold">Menu Products</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Menu Products
              </h1>
              <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 font-bold text-xs rounded-full">
                {products.length} {products.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/categories"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Categories</span>
            </Link>

            {canManage && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </div>

        {/* Alerts / Feedback Banners */}
        {serverError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{serverError}</span>
            </div>
            <button
              onClick={() => setServerError(null)}
              className="text-red-500 hover:text-red-800 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="UNCATEGORIZED">Uncategorized</option>
              </select>
            </div>

            {/* Availability Filter */}
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="AVAILABLE">In Stock</option>
              <option value="UNAVAILABLE">Sold Out</option>
            </select>
          </div>
        </div>

        {/* Product List Content */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-sm font-semibold text-slate-500">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          /* Zero State: No products in restaurant */
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-4 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <UtensilsCrossed className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">No menu products added yet</h3>
              <p className="text-sm text-slate-500">
                Start adding dishes, drinks, and combos to showcase your menu to dine-in customers.
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Product</span>
              </button>
            )}
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Filtered empty state */
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3">
            <p className="text-base font-semibold text-slate-700">No products match your filters</p>
            <p className="text-xs text-slate-400">Try adjusting your category or search keywords</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('ALL');
                setAvailabilityFilter('ALL');
              }}
              className="text-xs text-orange-600 font-bold hover:underline"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          /* Products Table / Cards */
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6 w-16 text-center">Order</th>
                    <th className="py-4 px-4 w-16">Item</th>
                    <th className="py-4 px-4">Details</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4 text-right">Price</th>
                    <th className="py-4 px-6 text-center">Availability</th>
                    {canManage && <th className="py-4 px-6 text-right w-24">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map((product, index) => {
                    const isFirst = index === 0;
                    const isLast = index === filteredProducts.length - 1;

                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !product.isAvailable ? 'bg-slate-50/40 text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        {/* Sort Reorder Buttons */}
                        <td className="py-4 px-6 text-center">
                          {canManage && filteredProducts.length > 1 ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                disabled={isFirst}
                                onClick={() => handleMoveProduct(index, 'up')}
                                title="Move Up"
                                className="p-1 rounded text-slate-400 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition"
                              >
                                <MoveUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled={isLast}
                                onClick={() => handleMoveProduct(index, 'down')}
                                title="Move Down"
                                className="p-1 rounded text-slate-400 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition"
                              >
                                <MoveDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">
                              #{product.sortOrder}
                            </span>
                          )}
                        </td>

                        {/* Image Thumbnail Preview */}
                        <td className="py-4 px-4">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 relative">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <UtensilsCrossed className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                        </td>

                        {/* Product Name & Veg Indicator */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {/* Veg / Non-Veg Indicator Icon */}
                              <span
                                className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                                  product.isVegetarian
                                    ? 'border-emerald-600 bg-white'
                                    : 'border-red-600 bg-white'
                                }`}
                                title={product.isVegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
                              >
                                {product.isVegetarian ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                ) : (
                                  <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-red-600" />
                                )}
                              </span>
                              <span className="font-bold text-slate-900">{product.name}</span>
                            </div>
                            {product.description && (
                              <p className="text-xs text-slate-500 line-clamp-1 max-w-sm">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4">
                          {product.categoryName ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {product.categoryName}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Uncategorized</span>
                          )}
                        </td>

                        {/* Price in INR */}
                        <td className="py-4 px-4 text-right">
                          <span className="font-black text-slate-900 font-mono text-base">
                            {formatPaise(product.price)}
                          </span>
                        </td>

                        {/* Availability Toggle */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => handleToggleAvailability(product)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition shadow-sm ${
                              product.isAvailable
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                            title={`Click to mark as ${product.isAvailable ? 'Sold Out' : 'In Stock'}`}
                          >
                            {product.isAvailable ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>In Stock</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Sold Out</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Action buttons (Owner/Admin only) */}
                        {canManage && (
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditClick(product)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                                title="Edit Product"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingProduct(product)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Delete Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Safe Deletion & Availability Note */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Safe Menu Data Policy</p>
            <p className="text-amber-800">
              Disabling availability (&quot;Sold Out&quot;) immediately hides products from customer order menus while preserving reporting. Deleting a product safely retains all historical order records and line-item snapshots.
            </p>
          </div>
        </div>
      </main>

      {/* Add / Edit Product Modal */}
      {(showAddModal || editingProduct) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingProduct ? 'Edit Menu Product' : 'Add New Product'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingProduct
                      ? 'Update item specifications, price or category.'
                      : 'Add an appetizing dish with pricing in paise.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Masala Dosa, Cold Brew Coffee, Paneer Tikka"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none ${
                    fieldErrors.name ? 'border-red-500 bg-red-50/30' : 'border-slate-200'
                  }`}
                  required
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* Category and Price Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="">No Category / General</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price in Rupees */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Price (₹ INR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="180.00"
                      value={formPriceRupees}
                      onChange={(e) => setFormPriceRupees(e.target.value)}
                      className={`w-full pl-8 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none ${
                        fieldErrors.price ? 'border-red-500 bg-red-50/30' : 'border-slate-200'
                      }`}
                      required
                    />
                  </div>
                  {fieldErrors.price ? (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.price}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Stored internally as{' '}
                      <strong className="text-slate-600">
                        {formPriceRupees && !isNaN(parseFloat(formPriceRupees))
                          ? `${rupeesToPaise(parseFloat(formPriceRupees))} paise`
                          : '0 paise'}
                      </strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  placeholder="Ingredients, preparation details, allergens or portion size..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none ${
                    fieldErrors.description ? 'border-red-500 bg-red-50/30' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.description && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>
                )}
              </div>

              {/* Image Upload & Preview (Cloudflare R2 Integration) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Image (Cloudflare R2)
                </label>
                <div className="flex gap-4 items-start">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
                    {uploadingImage ? (
                      <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                    ) : formImageUrl && formImageUrl.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={formImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileSelect}
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="hidden"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition disabled:opacity-50"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="w-3.5 h-3.5" />
                        )}
                        <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                      </button>

                      {formImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormImageKey(null);
                            setFormImageUrl('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-xs text-red-600 hover:bg-red-50 border border-slate-200 font-semibold transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {uploadError && (
                      <p className="text-xs text-red-600 font-medium">{uploadError}</p>
                    )}

                    <input
                      type="url"
                      placeholder="Or paste external image URL..."
                      value={formImageUrl}
                      onChange={(e) => {
                        setFormImageUrl(e.target.value);
                        setFormImageKey(null); // External URL doesn't use R2 key
                      }}
                      className={`w-full px-3 py-1.5 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none ${
                        fieldErrors.imageUrl ? 'border-red-500 bg-red-50/30' : 'border-slate-200'
                      }`}
                    />
                    <p className="text-[11px] text-slate-400">
                      Supports JPG, PNG, WebP, GIF, AVIF up to 5 MB. Stored securely on Cloudflare R2.
                    </p>
                  </div>
                </div>
                {fieldErrors.imageUrl && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.imageUrl}</p>
                )}
              </div>

              {/* Vegetarian & Available Checkboxes */}
              <div className="pt-2 grid grid-cols-2 gap-4 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsVegetarian}
                    onChange={(e) => setFormIsVegetarian(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Vegetarian (Veg)</span>
                    <p className="text-[11px] text-slate-400">Green veg badge on menu</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsAvailable}
                    onChange={(e) => setFormIsAvailable(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">In Stock</span>
                    <p className="text-[11px] text-slate-400">Visible for customer ordering</p>
                  </div>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Delete &quot;{deletingProduct.name}&quot;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to remove this product from your menu?
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 mt-2">
                <strong>Historical Order Preservation:</strong> Past completed orders will continue to retain the exact snapshot of this item&apos;s name and price.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
              >
                Keep Product
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteProduct}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

