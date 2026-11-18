'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
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
  X
} from 'lucide-react';
import Link from 'next/link';

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

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);
  const initialCatsLoadedRef = useRef(false);

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // Form input state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Load categories when active restaurant changes
  const loadCategories = useCallback(async (isSilent = false) => {
    if (!selectedRestaurant?.id) return;
    try {
      if (!isSilent && !initialCatsLoadedRef.current) {
        setLoading(true);
      }
      setServerError(null);
      const data = await apiRequest<Category[]>('/api/categories', {
        restaurantId: selectedRestaurant.id
      });
      initialCatsLoadedRef.current = true;
      setCategories(data);
    } catch (err: any) {
      setServerError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurant?.id]);

  useEffect(() => {
    if (selectedRestaurant?.id) {
      loadCategories();
    }
  }, [selectedRestaurant?.id, loadCategories]);

  // Handle Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmed = formName.trim();
    if (!trimmed) {
      errors.name = 'Category name is required';
    } else if (trimmed.length > 100) {
      errors.name = 'Category name cannot exceed 100 characters';
    }

    if (formDescription && formDescription.length > 500) {
      errors.description = 'Description cannot exceed 500 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    if (!validateForm()) return;

    setSubmitting(true);
    setServerError(null);

    try {
      const nextSortOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder)) + 1 : 0;

      await apiRequest('/api/categories', {
        method: 'POST',
        restaurantId: selectedRestaurant.id,
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          sortOrder: nextSortOrder,
          isActive: formIsActive
        })
      });

      setShowAddModal(false);
      resetForm();
      setSuccessMessage('Category created successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadCategories();
    } catch (err: any) {
      setServerError(err.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Category
  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !editingCategory) return;

    if (!validateForm()) return;

    setSubmitting(true);
    setServerError(null);

    try {
      await apiRequest(`/api/categories/${editingCategory.id}`, {
        method: 'PATCH',
        restaurantId: selectedRestaurant.id,
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          isActive: formIsActive
        })
      });

      setEditingCategory(null);
      resetForm();
      setSuccessMessage('Category updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadCategories();
    } catch (err: any) {
      setServerError(err.message || 'Failed to update category');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async () => {
    if (!canManage || !deletingCategory) return;

    setSubmitting(true);
    setServerError(null);

    try {
      await apiRequest(`/api/categories/${deletingCategory.id}`, {
        method: 'DELETE',
        restaurantId: selectedRestaurant.id
      });

      setDeletingCategory(null);
      setSuccessMessage('Category deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadCategories();
    } catch (err: any) {
      setServerError(err.message || 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  // Reorder Categories (Move Up / Down)
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!canManage) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCategories = [...categories];
    const target = newCategories[targetIndex];
    const current = newCategories[index];
    if (!target || !current) return;

    newCategories[index] = target;
    newCategories[targetIndex] = current;

    // Recalculate sequential sort orders
    const itemsToUpdate = newCategories.map((cat, idx) => ({
      id: cat.id,
      sortOrder: idx
    }));

    // Optimistic UI update
    setCategories(newCategories.map((c, idx) => ({ ...c, sortOrder: idx })));

    try {
      await apiRequest('/api/categories/reorder', {
        method: 'PUT',
        restaurantId: selectedRestaurant.id,
        body: JSON.stringify({ items: itemsToUpdate })
      });
    } catch (err: any) {
      setServerError('Failed to save category order: ' + err.message);
      await loadCategories(); // rollback
    }
  };

  // Quick toggle category active status
  const handleToggleActive = async (cat: Category) => {
    if (!canManage) return;
    try {
      await apiRequest(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        restaurantId: selectedRestaurant.id,
        body: JSON.stringify({ isActive: !cat.isActive })
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
      );
    } catch (err: any) {
      setServerError('Failed to toggle category status: ' + err.message);
    }
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormDescription(cat.description || '');
    setFormIsActive(cat.isActive);
    setFieldErrors({});
    setServerError(null);
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormIsActive(true);
    setFieldErrors({});
    setServerError(null);
  };

  if (sessionLoading && !initialLoadedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition text-sm font-semibold pr-4 border-r border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white font-bold flex items-center justify-center">
              M
            </div>
            <span className="font-extrabold text-lg text-slate-900 hidden sm:inline">
              Menu<span className="text-orange-600">Go</span>
            </span>
          </div>

          {/* Restaurant switcher */}
          {restaurants.length > 0 && (
            <select
              value={selectedRestaurant?.id || ''}
              onChange={(e) => {
                const found = restaurants.find((r) => r.restaurant.id === e.target.value);
                if (found) setSelectedMembership(found);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500"
            >
              {restaurants.map((item) => (
                <option key={item.restaurant.id} value={item.restaurant.id}>
                  {item.restaurant.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            {currentRole}
          </span>

          <button
            onClick={async () => {
              await signOut();
              router.push('/admin/login');
            }}
            className="p-2 text-slate-500 hover:text-red-600 transition"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black text-slate-900">Category Management</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Organize digital menu sections (e.g. Starters, Main Course, Drinks) and customize display sequence.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          )}
        </div>

        {/* Global Alert Messages */}
        {serverError && (
          <div className="p-4 bg-red-50 text-red-800 text-sm rounded-2xl border border-red-200 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Action Failed</p>
              <p className="text-xs text-red-700 mt-0.5">{serverError}</p>
            </div>
            <button onClick={() => setServerError(null)} className="text-red-400 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 text-emerald-800 text-sm rounded-2xl border border-emerald-200 flex items-center gap-3 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="font-semibold text-xs">{successMessage}</p>
          </div>
        )}

        {/* Category List */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading restaurant categories...</p>
          </div>
        ) : categories.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No Categories Yet</h3>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Create your first menu category (e.g. &quot;Appetizers&quot; or &quot;Beverages&quot;) so you can organize your food and drinks.
            </p>
            {canManage && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Category</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((cat, index) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow transition flex items-center justify-between gap-4"
              >
                {/* Reorder and Info */}
                <div className="flex items-center gap-4 flex-1">
                  {canManage && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded transition"
                        title="Move Up"
                      >
                        <MoveUp className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] font-mono font-bold text-slate-400 select-none">
                        #{index + 1}
                      </span>
                      <button
                        disabled={index === categories.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded transition"
                        title="Move Down"
                      >
                        <MoveDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-900">{cat.name}</h4>
                      {!cat.isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                          Archived
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xl line-clamp-1">
                        {cat.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Toggle & Actions */}
                <div className="flex items-center gap-2">
                  {canManage && (
                    <>
                      <button
                        onClick={() => handleToggleActive(cat)}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                          cat.isActive
                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            : 'border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100'
                        }`}
                        title={cat.isActive ? 'Active - Click to archive' : 'Archived - Click to activate'}
                      >
                        {cat.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{cat.isActive ? 'Active' : 'Archived'}</span>
                      </button>

                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                        title="Edit Category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingCategory(cat)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
                        title="Delete Category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add Menu Category</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={submitting}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Starters & Appetizers"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition focus:ring-2 ${
                    fieldErrors.name
                      ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                      : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
                  }`}
                />
                {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  disabled={submitting}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Crispy fried snacks, soup, and starter delicacies..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 resize-none"
                />
                {fieldErrors.description && <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Make Available Immediately</span>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Category</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Category</h3>
              <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={submitting}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition focus:ring-2 ${
                    fieldErrors.name
                      ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                      : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
                  }`}
                />
                {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  disabled={submitting}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 resize-none"
                />
                {fieldErrors.description && <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Active on Menu</span>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Delete Category</h3>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to delete <span className="font-bold text-slate-900">&quot;{deletingCategory.name}&quot;</span>?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-3">
              Note: Categories containing products cannot be deleted. You must reassign or remove products first.
            </p>

            <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteCategory}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Category</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
