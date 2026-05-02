import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertMessage } from "@/components/AlertMessage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_ENDPOINTS, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Pencil, Plus, Trash2, ArrowLeft } from "lucide-react";

type YearLevel = {
  id: string;
  name: string;
};

type EditableItem = {
  localId: string;
  item_name: string;
  amount: string;
  is_required: boolean;
};

type TuitionPackageItem = {
  id: string;
  item_name: string;
  amount: number;
  is_required: boolean;
  sort_order: number;
};

type TuitionPackage = {
  id: string;
  name: string;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  levels: string[];
  items: TuitionPackageItem[];
  total?: number;
};

const TuitionPackages = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [yearLevels, setYearLevels] = useState<YearLevel[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [packages, setPackages] = useState<TuitionPackage[]>([]);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [deletePackageTarget, setDeletePackageTarget] = useState<TuitionPackage | null>(null);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  const parseYearLevels = (response: any): YearLevel[] => {
    const rows =
      response?.year_levels ||
      response?.data ||
      (Array.isArray(response) ? response : []);

    if (!Array.isArray(rows)) return [];

    return rows
      .map((row: any) => ({
        id: String(row.id ?? row.value ?? row.name),
        name: String(row.name ?? row.level_name ?? row.year_level ?? row.label ?? ""),
      }))
      .filter((row: YearLevel) => row.name.trim().length > 0);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [yearLevelRes, feesRes] = await Promise.all([
        apiGet(API_ENDPOINTS.YEAR_LEVELS),
        apiGet(API_ENDPOINTS.TUITION_PACKAGES),
      ]);

      const fetchedLevels = parseYearLevels(yearLevelRes);
      const data: TuitionPackage[] = feesRes?.data || [];

      setYearLevels(fetchedLevels);
      setPackages(Array.isArray(data) ? data : []);

      if (fetchedLevels.length > 0) {
        setSelectedLevels((prev) => (prev.length > 0 ? prev : [fetchedLevels[0].name]));
      }
    } catch (error: any) {
      showAlert("error", error?.message || "Failed to load tuition package data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
      return;
    }

    fetchData();
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (!isEditorOpen) return;
    if (!editingPackageId) return; // Don't auto-populate when creating a new package

    if (selectedLevels.length === 0) {
      setItems([]);
      return;
    }

    const activePackages = selectedLevels
      .map((level) => packages.find((pkg) => pkg.is_active && pkg.levels?.includes(level)))
      .filter(Boolean) as TuitionPackage[];

    const uniquePackageIds = new Set(activePackages.map((pkg) => pkg.id));

    if (uniquePackageIds.size > 1) {
      setItems([]);
      showAlert("info", "Selected levels have different packages. Select levels that share the same package to edit.");
      return;
    }

    const activePackage = activePackages[0];
    if (!activePackage || !Array.isArray(activePackage.items) || activePackage.items.length === 0) {
      setItems([]);
      return;
    }

    const mappedItems = activePackage.items.map((item, index) => ({
      localId: `${activePackage.id}-${item.id || index}`,
      item_name: item.item_name,
      amount: String(Number(item.amount || 0)),
      is_required: Boolean(item.is_required),
    }));

    setItems(mappedItems);
  }, [selectedLevels, packages, isEditorOpen, editingPackageId]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }, [items]);

  const PACKAGE_COLORS = [
    {
      card: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60",
      header: "bg-gradient-to-r from-blue-100/80 to-blue-50",
      badge: "bg-blue-100 text-blue-700 border-blue-300",
      total: "text-blue-700",
      accent: "bg-blue-500",
    },
    {
      card: "border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/60",
      header: "bg-gradient-to-r from-violet-100/80 to-violet-50",
      badge: "bg-violet-100 text-violet-700 border-violet-300",
      total: "text-violet-700",
      accent: "bg-violet-500",
    },
    {
      card: "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/60",
      header: "bg-gradient-to-r from-amber-100/80 to-amber-50",
      badge: "bg-amber-100 text-amber-700 border-amber-300",
      total: "text-amber-700",
      accent: "bg-amber-500",
    },
    {
      card: "border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/60",
      header: "bg-gradient-to-r from-teal-100/80 to-teal-50",
      badge: "bg-teal-100 text-teal-700 border-teal-300",
      total: "text-teal-700",
      accent: "bg-teal-500",
    },
    {
      card: "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60",
      header: "bg-gradient-to-r from-rose-100/80 to-rose-50",
      badge: "bg-rose-100 text-rose-700 border-rose-300",
      total: "text-rose-700",
      accent: "bg-rose-500",
    },
    {
      card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60",
      header: "bg-gradient-to-r from-emerald-100/80 to-emerald-50",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-300",
      total: "text-emerald-700",
      accent: "bg-emerald-500",
    },
  ];

  const getLevelInitials = (level: string): string => {
    if (level === "Kinder") return "K";
    if (level.startsWith("Nursery")) return `N${level.split(" ")[1]}`;
    if (level.startsWith("Grade")) return `G${level.split(" ")[1]}`;
    return level;
  };

  const existingPackages = useMemo(() => {
    const sorted = [...packages].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime();
    });

    const levelOrder = yearLevels.map((level) => level.name);
    const getOrderIndex = (level: string) => {
      const index = levelOrder.indexOf(level);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };

    return sorted.map((pkg) => ({
      ...pkg,
      total:
        Number(pkg.total ?? 0) ||
        pkg.items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      levels: [...pkg.levels].sort((a, b) => getOrderIndex(a) - getOrderIndex(b)),
    }));
  }, [packages, yearLevels]);

  const toggleLevel = (levelName: string) => {
    setSelectedLevels((prev) =>
      prev.includes(levelName)
        ? prev.filter((name) => name !== levelName)
        : [...prev, levelName]
    );
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        item_name: "",
        amount: "",
        is_required: true,
      },
    ]);
  };

  const updateItem = (localId: string, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
  };

  const resetEditor = () => {
    setEditingPackageId(null);
    setSelectedLevels([]);
    setItems([]);
  };

  const openCreateEditor = () => {
    setIsEditorOpen(true);
    setEditingPackageId(null);
    setSelectedLevels([]); // Start blank — user picks the levels they want
    setItems([
      {
        localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        item_name: "",
        amount: "",
        is_required: true,
      },
    ]);
  };

  const openEditEditor = (pkg: TuitionPackage) => {
    setIsEditorOpen(true);
    setEditingPackageId(pkg.id);
    setSelectedLevels(pkg.levels || []);
    setItems(
      (pkg.items || []).map((item, index) => ({
        localId: `${pkg.id}-${item.id || index}`,
        item_name: item.item_name,
        amount: String(Number(item.amount || 0)),
        is_required: Boolean(item.is_required),
      }))
    );
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    resetEditor();
  };

  const handleDeletePackage = async (pkg: TuitionPackage) => {
    try {
      await apiDelete(API_ENDPOINTS.TUITION_PACKAGE_BY_ID(pkg.id));
      showAlert("success", "Tuition package deleted successfully");
      if (editingPackageId === pkg.id) {
        closeEditor();
      }
      await fetchData();
    } catch (error: any) {
      showAlert("error", error?.message || "Failed to delete tuition package");
    }
  };

  const requestDeletePackage = (pkg: TuitionPackage) => {
    setDeletePackageTarget(pkg);
  };

  const handleSaveClick = () => {
    if (!editingPackageId) {
      // Show confirmation modal for new packages
      if (selectedLevels.length === 0) {
        showAlert("error", "Select at least one year level");
        return;
      }

      const cleanedItems = items
        .map((item) => ({ ...item, item_name: item.item_name.trim() }))
        .filter((item) => item.item_name.length > 0 || item.amount.length > 0);

      if (cleanedItems.length === 0) {
        showAlert("error", "Add at least one fee item");
        return;
      }

      setShowCreateConfirm(true);
    } else {
      saveItems();
    }
  };

  const saveItems = async () => {
    if (selectedLevels.length === 0) {
      showAlert("error", "Select at least one year level");
      return;
    }

    const cleanedItems = items
      .map((item) => ({ ...item, item_name: item.item_name.trim() }))
      .filter((item) => item.item_name.length > 0 || item.amount.length > 0);

    if (cleanedItems.length === 0) {
      showAlert("error", "Add at least one fee item");
      return;
    }

    const hasInvalidAmount = cleanedItems.some((item) => {
      const amount = Number(item.amount);
      return !Number.isFinite(amount) || amount < 0;
    });

    if (hasInvalidAmount) {
      showAlert("error", "One or more items have invalid amount");
      return;
    }

    const duplicateNames = new Set<string>();
    for (const item of cleanedItems) {
      const key = item.item_name.toLowerCase();
      if (duplicateNames.has(key)) {
        showAlert("error", "Duplicate item name found. Use unique names.");
        return;
      }
      duplicateNames.add(key);
    }

    setSaving(true);
    try {
      const payload = {
        year_levels: selectedLevels,
        items: cleanedItems.map((item, index) => ({
          item_name: item.item_name,
          amount: Number(item.amount || 0),
          is_required: item.is_required ? 1 : 0,
          sort_order: index + 1,
        })),
      };

      if (editingPackageId) {
        await apiPut(API_ENDPOINTS.TUITION_PACKAGE_BY_ID(editingPackageId), payload);
        showAlert("success", "Tuition package updated successfully");
      } else {
        await apiPost(API_ENDPOINTS.TUITION_PACKAGES, payload);
        showAlert("success", "Tuition package created successfully");
      }

      await fetchData();
      closeEditor();
    } catch (error: any) {
      showAlert("error", error?.message || "Failed to save tuition package items");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading tuition packages...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6 max-w-[1500px]">
        <div className="flex items-start justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/payments')}
              className="mb-6 gap-2 text-base font-medium hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Payments
            </Button>

            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Tuition Fee Packages
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage tuition fee structures per year level. Select year levels, define fee items, and save to create a versioned package.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card className="shadow-xl border-0 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-white text-lg">Already Made Packages</CardTitle>
                  <CardDescription className="text-slate-300 text-xs mt-0.5">
                    {existingPackages.length} package{existingPackages.length !== 1 ? "s" : ""} &mdash; grouped by year level
                  </CardDescription>
                </div>
                <Button type="button" onClick={openCreateEditor} className="bg-white text-slate-800 hover:bg-slate-100 font-semibold shadow-md">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Package
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {existingPackages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <div className="text-4xl mb-2">📦</div>
                  <p className="text-sm font-medium">No packages yet</p>
                  <p className="text-xs mt-1">Click &ldquo;Create Package&rdquo; to get started.</p>
                </div>
              )}

              {existingPackages.map((pkg, pkgIndex) => {
                const isEditingThis = editingPackageId === pkg.id;
                const colors = PACKAGE_COLORS[pkgIndex % PACKAGE_COLORS.length];
                return (
                  <div
                    key={pkg.id}
                    className={`border-2 rounded-xl overflow-visible transition-all duration-200 ${
                      isEditingThis
                        ? "border-primary shadow-lg ring-2 ring-primary/20 bg-primary/5"
                        : pkg.is_active
                        ? `${colors.card} shadow-sm hover:shadow-md`
                        : "border-slate-200 bg-slate-50 opacity-70"
                    }`}
                  >
                    {/* Card header strip */}
                    <div className={`px-4 py-3 border-b border-black/5 rounded-t-xl ${
                      isEditingThis ? "bg-primary/10" : pkg.is_active ? colors.header : "bg-slate-100"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-sm truncate">{pkg.name}</span>
                          {pkg.is_active
                            ? <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300">Active</span>
                            : <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-500 border border-slate-300">Inactive</span>
                          }
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{pkg.items.length} item{pkg.items.length !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Effective: {pkg.effective_from}</p>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      {/* Level badges */}
                      <div className="flex flex-wrap gap-2">
                        {pkg.levels.map((level) => (
                          <span
                            key={`${pkg.id}-${level}`}
                            title={level}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                              pkg.is_active && !isEditingThis ? colors.badge : "bg-slate-100 text-slate-600 border-slate-300"
                            }`}
                          >
                            {getLevelInitials(level)}
                          </span>
                        ))}
                      </div>

                      {/* Fee items */}
                      <div className="space-y-1">
                        {pkg.items.slice(0, 4).map((item) => (
                          <div key={`${pkg.id}-${item.id}`} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-muted-foreground">{item.item_name}</span>
                            <span className="font-semibold text-foreground shrink-0">₱{Number(item.amount).toLocaleString()}</span>
                          </div>
                        ))}
                        {pkg.items.length > 4 && (
                          <p className="text-[11px] text-muted-foreground italic">+{pkg.items.length - 4} more item(s)</p>
                        )}
                      </div>

                      {/* Total */}
                      <div className="pt-2 border-t border-black/5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</span>
                        <span className={`text-base font-bold ${
                          isEditingThis ? "text-primary" : pkg.is_active ? colors.total : "text-foreground"
                        }`}>
                          ₱{Number(pkg.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditEditor(pkg)}
                          className="flex-1 h-8 text-xs font-medium hover:bg-slate-100 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => requestDeletePackage(pkg)}
                          className="flex-1 h-8 text-xs font-medium"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-5">
            {isEditorOpen && (
              <div>
                <h2 className="text-xl font-bold">Operations</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Define and manage fee structures</p>
              </div>
            )}

            {isEditorOpen && (
              <>
            <Card className="shadow-xl border-0 rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50 border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">YL</span>
                  </div>
                  <div>
                    <CardTitle className="text-base">Year Levels</CardTitle>
                    <CardDescription className="text-xs">Select one or more levels to apply the same fee items.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  {yearLevels.map((level) => {
                    const selected = selectedLevels.includes(level.name);
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => toggleLevel(level.name)}
                        title={level.name}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all duration-150 ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                            : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        {getLevelInitials(level.name)}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50 border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">{editingPackageId ? "E" : "C"}</span>
                  </div>
                  <div>
                    <CardTitle className="text-base">{editingPackageId ? "Edit Package Items" : "Create Package Items"}</CardTitle>
                    <CardDescription className="text-xs">
                      Define fee items (name &amp; amount). Save applies all rows to selected year levels.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {items.map((item) => (
                  <div key={item.localId} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end bg-slate-50 border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors">
                    <div className="flex-[2] space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Name</Label>
                      <Input
                        value={item.item_name}
                        onChange={(event) => updateItem(item.localId, { item_name: event.target.value })}
                        placeholder="e.g. Enrollment Fee"
                        className="h-9 text-sm bg-white"
                      />
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount (₱)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) => updateItem(item.localId, { amount: event.target.value })}
                        placeholder="0.00"
                        className="h-9 text-sm bg-white"
                      />
                    </div>

                    <div className="flex gap-2 items-end">
                      <button
                        type="button"
                        onClick={() => updateItem(item.localId, { is_required: !item.is_required })}
                        className={`h-9 px-3 rounded-lg text-xs font-semibold border-2 transition-all duration-150 ${
                          item.is_required
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        {item.is_required ? "Required" : "Optional"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.localId)}
                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 border-2 border-red-200 hover:bg-red-100 hover:border-red-400 transition-all"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <Button type="button" variant="outline" onClick={addItemRow} className="h-9 text-sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Item
                  </Button>

                  <div className="text-sm font-bold text-primary">
                    Total: ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={closeEditor} className="h-9 text-sm">
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSaveClick} disabled={saving || selectedLevels.length === 0} className="h-9 text-sm font-semibold">
                      {saving ? "Saving..." : editingPackageId ? "Update Package" : "Save New Package"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
              </>
            )}
          </div>
        </div>

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

        {/* Create Package Confirmation Modal */}
        <Dialog open={showCreateConfirm} onOpenChange={(open) => !open && setShowCreateConfirm(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create New Package</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Are you sure you want to create a new tuition package for the following year level{selectedLevels.length !== 1 ? "s" : ""}?
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Year Levels</p>
              <div className="flex flex-wrap gap-2">
                {selectedLevels.map((level) => (
                  <span
                    key={level}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/30"
                  >
                    {level}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {items.filter((i) => i.item_name.trim()).length} fee item{items.filter((i) => i.item_name.trim()).length !== 1 ? "s" : ""} &middot; Total: ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCreateConfirm(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  setShowCreateConfirm(false);
                  await saveItems();
                }}
                disabled={saving || items.filter((i) => i.item_name.trim()).length === 0}
              >
                {saving ? "Saving..." : "Yes, Create Package"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deletePackageTarget} onOpenChange={() => setDeletePackageTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-600">Delete Package</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deletePackageTarget?.name}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeletePackageTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!deletePackageTarget) return;
                  const target = deletePackageTarget;
                  setDeletePackageTarget(null);
                  await handleDeletePackage(target);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default TuitionPackages;