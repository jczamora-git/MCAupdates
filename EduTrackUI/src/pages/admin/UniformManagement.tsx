import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertMessage } from "@/components/AlertMessage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { API_ENDPOINTS, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/Confirm";
import { ArrowLeft, Pencil, Plus, Shirt, Trash2, ToggleLeft } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";

// ─── Types ──────────────────────────────────────────────────────────────────

type ItemGroup = "Dress" | "Blouse" | "Skirt" | "Polo" | "PE" | "Others";
type Gender = "Male" | "Female" | "All";

type UniformPrice = {
  id?: string;
  size: string;
  price: string;
  half_price: string;
};

type UniformItem = {
  id: string;
  item_name: string;
  item_group: ItemGroup;
  applicable_levels: string[];
  applicable_gender: Gender;
  is_pair: boolean;
  allow_half_price: boolean;
  is_active: boolean;
  prices: Array<{
    id: string;
    size: string;
    price: number | string;
    half_price: number | string | null;
    is_active: boolean;
  }>;
};

type EditableItem = {
  id?: string;
  item_name: string;
  item_group: ItemGroup;
  applicable_levels: string[];
  applicable_gender: Gender;
  is_pair: boolean;
  allow_half_price: boolean;
  is_active: boolean;
  prices: UniformPrice[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEM_GROUPS: ItemGroup[] = ["Dress", "Blouse", "Skirt", "Polo", "PE", "Others"];
const GENDERS: Gender[] = ["All", "Male", "Female"];
const YEAR_LEVELS = [
  "Nursery 1",
  "Nursery 2",
  "Kinder",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
];

const SIZE_OPTIONS = [
  "#2",
  "#4",
  "#6",
  "#8",
  "#10",
  "#12",
  "#14",
  "#16",
  "#18",
  "#20",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
];

const GROUP_COLORS: Record<ItemGroup, { card: string; badge: string; icon: string }> = {
  Dress:  { card: "border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100/60",   badge: "bg-pink-100 text-pink-700 border-pink-300",   icon: "text-pink-500" },
  Blouse: { card: "border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/60", badge: "bg-violet-100 text-violet-700 border-violet-300", icon: "text-violet-500" },
  Skirt:  { card: "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60",     badge: "bg-rose-100 text-rose-700 border-rose-300",     icon: "text-rose-500" },
  Polo:   { card: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60",     badge: "bg-blue-100 text-blue-700 border-blue-300",     icon: "text-blue-500" },
  PE:     { card: "border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/60",     badge: "bg-teal-100 text-teal-700 border-teal-300",     icon: "text-teal-500" },
  Others: { card: "border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/60",     badge: "bg-gray-100 text-gray-700 border-gray-300",     icon: "text-gray-500" },
};

const getDefaultGenderByCategory = (category: ItemGroup): Gender => {
  if (category === "Dress" || category === "Blouse" || category === "Skirt") return "Female";
  if (category === "Polo") return "Male";
  return "All"; // PE and Others default to All
};

function emptyEditable(): EditableItem {
  return {
    item_name: "",
    item_group: "Polo",
    applicable_levels: [],
    applicable_gender: "All",
    is_pair: false,
    allow_half_price: false,
    is_active: true,
    prices: [{ size: "", price: "", half_price: "" }],
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

const UniformManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<UniformItem[]>([]);
  const [orderedUniformItemIds, setOrderedUniformItemIds] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editable, setEditable] = useState<EditableItem>(emptyEditable());
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [batchPrice, setBatchPrice] = useState("");
  const [batchHalfPrice, setBatchHalfPrice] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<UniformItem | null>(null);
  const [filterGroup, setFilterGroup] = useState<ItemGroup | "All">("All");

  const showAlert = (type: "success" | "error" | "info", message: string) => setAlert({ type, message });

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiGet(API_ENDPOINTS.UNIFORM_ITEMS);
      setItems(Array.isArray(res?.data) ? res.data : []);

      try {
        const ordersRes = await apiGet(API_ENDPOINTS.UNIFORM_ORDERS);
        const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
        const usedIds = new Set<string>();
        orders.forEach((order: any) => {
          if (order?.uniform_item_id !== undefined && order?.uniform_item_id !== null) {
            usedIds.add(String(order.uniform_item_id));
          }
        });
        setOrderedUniformItemIds(usedIds);
      } catch {
        setOrderedUniformItemIds(new Set());
      }
    } catch (err: any) {
      showAlert("error", err?.message || "Failed to load uniform items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
      return;
    }
    fetchItems();
  }, [isAuthenticated, user, navigate]);

  // ── Memos ──────────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (filterGroup === "All") return items;
    return items.filter((i) => i.item_group === filterGroup);
  }, [items, filterGroup]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { All: items.length };
    for (const group of ITEM_GROUPS) {
      counts[group] = items.filter((i) => i.item_group === group).length;
    }
    return counts;
  }, [items]);

  // ── Editor helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditable(emptyEditable());
    setSelectedSizes([]);
    setBatchPrice("");
    setBatchHalfPrice("");
    setEditorOpen(true);
  };

  const openEdit = (item: UniformItem) => {
    const mappedPrices = item.prices.length
      ? item.prices.map((p) => ({
          id: p.id,
          size: p.size,
          price: String(p.price ?? ""),
          half_price: p.half_price !== null && p.half_price !== undefined ? String(p.half_price) : "",
        }))
      : [{ size: "", price: "", half_price: "" }];

    setEditable({
      id: item.id,
      item_name: item.item_name,
      item_group: item.item_group,
      applicable_levels: [...(item.applicable_levels || [])],
      applicable_gender: item.applicable_gender,
      is_pair: item.is_pair,
      allow_half_price: item.allow_half_price,
      is_active: item.is_active,
      prices: mappedPrices,
    });
    const mappedSizes = mappedPrices.filter((p) => p.size.trim() !== "").map((p) => p.size);
    setSelectedSizes(mappedSizes);
    const uniquePrices = Array.from(new Set(mappedPrices.map((p) => p.price).filter((v) => v !== "")));
    const uniqueHalfPrices = Array.from(new Set(mappedPrices.map((p) => p.half_price).filter((v) => v !== "")));
    setBatchPrice(uniquePrices.length === 1 ? uniquePrices[0] : "");
    setBatchHalfPrice(uniqueHalfPrices.length === 1 ? uniqueHalfPrices[0] : "");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditable(emptyEditable());
    setSelectedSizes([]);
    setBatchPrice("");
    setBatchHalfPrice("");
  };

  const patchEditable = (patch: Partial<EditableItem>) =>
    setEditable((prev) => ({ ...prev, ...patch }));

  const handleCategoryChange = (category: ItemGroup) => {
    patchEditable({
      item_group: category,
      applicable_gender: getDefaultGenderByCategory(category),
      allow_half_price: category === "PE" ? true : editable.allow_half_price,
    });
  };

  const toggleLevel = (level: string) => {
    setEditable((prev) => ({
      ...prev,
      applicable_levels: prev.applicable_levels.includes(level)
        ? prev.applicable_levels.filter((l) => l !== level)
        : [...prev.applicable_levels, level],
    }));
  };

  const toggleSizeSelection = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const removeConfiguredSize = (size: string) => {
    patchEditable({ prices: editable.prices.filter((row) => row.size !== size) });
    setSelectedSizes((prev) => prev.filter((s) => s !== size));
  };

  // Auto-compute half price from main price when half-price mode is enabled (PE default flow)
  useEffect(() => {
    if (!editable.allow_half_price) return;
    if (batchPrice === "" || isNaN(Number(batchPrice))) {
      setBatchHalfPrice("");
      return;
    }

    const computed = (Number(batchPrice) / 2).toFixed(2);
    setBatchHalfPrice(computed);
  }, [batchPrice, editable.allow_half_price]);

  // Auto-apply current price fields to selected sizes (no apply button needed)
  useEffect(() => {
    if (selectedSizes.length === 0) return;
    if (batchPrice === "" || isNaN(Number(batchPrice)) || Number(batchPrice) < 0) return;

    setEditable((prev) => {
      const map = new Map<string, UniformPrice>();
      prev.prices.forEach((row) => {
        if (!row.size.trim()) return;
        map.set(row.size, row);
      });

      selectedSizes.forEach((size) => {
        const existing = map.get(size);
        map.set(size, {
          id: existing?.id,
          size,
          price: batchPrice,
          half_price: prev.allow_half_price ? batchHalfPrice : "",
        });
      });

      const ordered = Array.from(map.values()).sort(
        (a, b) => SIZE_OPTIONS.indexOf(a.size) - SIZE_OPTIONS.indexOf(b.size)
      );

      return {
        ...prev,
        prices: ordered,
      };
    });
  }, [selectedSizes, batchPrice, batchHalfPrice]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!editable.item_name.trim()) {
      showAlert("error", "Item name is required");
      return;
    }

    // Filter valid prices based on category
    let validPrices: UniformPrice[] = [];
    
    if (editable.item_group === "Others") {
      // For "Others": use the direct price input (batchPrice) and store as One Size
      const sourcePrice = batchPrice.trim() !== ""
        ? batchPrice.trim()
        : (editable.prices[0]?.price ?? "").trim();

      if (sourcePrice === "") {
        showAlert("error", "Please enter a price for this item");
        return;
      }

      validPrices = [{
        size: "One Size",
        price: sourcePrice,
        half_price: editable.allow_half_price ? batchHalfPrice : "",
      }];
    } else {
      // For other categories: require both size and price
      validPrices = editable.prices.filter((p) => p.size.trim() !== "" && p.price !== "");
      
      if (validPrices.length === 0) {
        showAlert("error", "Add at least one size/price entry");
        return;
      }
    }

    const badPrice = validPrices.find((p) => isNaN(Number(p.price)) || Number(p.price) < 0);
    if (badPrice) {
      showAlert("error", `Invalid price for ${editable.item_group === "Others" ? "this item" : `size "${badPrice.size}"`}`);
      return;
    }

    const confirmed = await confirm({
      title: editable.id ? "Update Uniform Item" : "Create Uniform Item",
      description: `${editable.id ? "Update" : "Create"} "${editable.item_name || "this item"}" with ${validPrices.length} size(s)?`,
      confirmText: editable.id ? "Update" : "Create",
      cancelText: "Cancel",
      variant: "default",
    });

    if (!confirmed) return;

    setSaving(true);
    try {
      const payload = {
        item_name: editable.item_name.trim(),
        item_group: editable.item_group,
        applicable_levels: editable.applicable_levels,
        applicable_gender: editable.applicable_gender,
        is_pair: editable.is_pair,
        allow_half_price: editable.allow_half_price,
        is_active: editable.is_active,
        prices: validPrices.map((p) => ({
          size: p.size.trim(),
          price: Number(p.price),
          half_price: editable.allow_half_price && p.half_price !== "" ? Number(p.half_price) : null,
        })),
      };

      if (editable.id) {
        await apiPut(API_ENDPOINTS.UNIFORM_ITEM_BY_ID(editable.id), payload);
        showAlert("success", "Uniform item updated successfully");
      } else {
        await apiPost(API_ENDPOINTS.UNIFORM_ITEMS, payload);
        showAlert("success", "Uniform item created successfully");
      }

      await fetchItems();
      closeEditor();
    } catch (err: any) {
      showAlert("error", err?.message || "Failed to save uniform item");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (item: UniformItem) => {
    if (orderedUniformItemIds.has(String(item.id))) {
      showAlert("error", "There is an orders for this item you cant delete this");
      return;
    }

    try {
      await apiDelete(API_ENDPOINTS.UNIFORM_ITEM_BY_ID(item.id));
      showAlert("success", "Uniform item deleted");
      await fetchItems();
    } catch (err: any) {
      const rawMessage = String(err?.message || "");
      const normalized = rawMessage.toLowerCase();

      if (
        normalized.includes("student_uniform_orders") ||
        normalized.includes("cannot delete or update a parent row") ||
        normalized.includes("foreign key constraint fails")
      ) {
        showAlert("error", "There is an orders for this item you cant delete this");
        return;
      }

      showAlert("error", rawMessage || "Failed to delete uniform item");
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────────

  const handleToggle = async (item: UniformItem) => {
    try {
      await apiPut(API_ENDPOINTS.UNIFORM_ITEM_TOGGLE(item.id), {});
      await fetchItems();
    } catch (err: any) {
      showAlert("error", err?.message || "Failed to toggle status");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading uniform items...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <FeatureGate feature="payment" showComingSoon>
      <DashboardLayout>
        <div className="p-8 space-y-6 max-w-[1400px]">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/admin/uniform-orders")}
              className="mb-6 gap-2 text-base font-medium hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Uniform Orders
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Uniform Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage uniform items, sizes, and prices. Items here appear in student uniform order forms.
            </p>
          </div>
          <div className="mt-14">
            <Button onClick={openCreate} className="gap-2 font-semibold">
              <Plus className="h-4 w-4" />
              Add Uniform Item
            </Button>
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex flex-wrap gap-2">
          {(["All", ...ITEM_GROUPS] as (ItemGroup | "All")[]).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setFilterGroup(group)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                filterGroup === group
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
              }`}
            >
              {group}{" "}
              <span className="ml-1 opacity-70">({groupCounts[group] ?? 0})</span>
            </button>
          ))}
        </div>

        {/* ── Grid of items ── */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Shirt className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">No uniform items yet</p>
            <p className="text-sm mt-1">Click &ldquo;Add Uniform Item&rdquo; to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => {
              const colors = GROUP_COLORS[item.item_group] ?? GROUP_COLORS["Polo"];
              const hasOrders = orderedUniformItemIds.has(String(item.id));
              return (
                <Card
                  key={item.id}
                  className={`border-2 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
                    item.is_active ? colors.card : "border-slate-200 bg-slate-50 opacity-70"
                  }`}
                >
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-sm font-bold leading-tight truncate">
                          {item.item_name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0 font-semibold border ${colors.badge}`}
                          >
                            {item.item_group}
                          </Badge>
                          {item.applicable_gender !== "All" && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0">
                              {item.applicable_gender}
                            </Badge>
                          )}
                          {item.is_pair && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 bg-yellow-50 text-yellow-700 border-yellow-300">
                              Pair
                            </Badge>
                          )}
                          {item.allow_half_price && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 bg-orange-50 text-orange-700 border-orange-300">
                              ½ Price
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.is_active
                            ? "bg-green-50 text-green-700 border-green-300"
                            : "bg-slate-100 text-slate-500 border-slate-300"
                        }`}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Applicable levels */}
                    {item.applicable_levels && item.applicable_levels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.applicable_levels.map((lvl) => (
                          <span
                            key={lvl}
                            className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 font-medium"
                          >
                            {lvl}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Prices */}
                    {item.prices && item.prices.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sizes &amp; Prices</p>
                        <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-2 py-1 font-semibold text-slate-500">Size</th>
                                <th className="text-right px-2 py-1 font-semibold text-slate-500">Price</th>
                                {item.allow_half_price && (
                                  <th className="text-right px-2 py-1 font-semibold text-slate-500">½ Price</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {item.prices.slice(0, 6).map((p, i) => (
                                <tr key={p.id ?? i} className="border-b border-slate-100 last:border-0">
                                  <td className="px-2 py-1 font-medium">{p.size}</td>
                                  <td className="px-2 py-1 text-right">₱{Number(p.price).toLocaleString()}</td>
                                  {item.allow_half_price && (
                                    <td className="px-2 py-1 text-right text-slate-500">
                                      {p.half_price != null ? `₱${Number(p.half_price).toLocaleString()}` : "—"}
                                    </td>
                                  )}
                                </tr>
                              ))}
                              {item.prices.length > 6 && (
                                <tr>
                                  <td colSpan={3} className="px-2 py-1 text-slate-400 italic text-center">
                                    +{item.prices.length - 6} more
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No prices defined</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        title={item.is_active ? "Deactivate" : "Activate"}
                        onClick={() => handleToggle(item)}
                      >
                        <ToggleLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs"
                        title={hasOrders ? "Cannot delete: item has existing orders" : "Delete item"}
                        disabled={hasOrders}
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Alert ── */}
        {alert && (
          <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        )}

        {/* ── Create / Edit Dialog ── */}
        <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {editable.id ? "Edit Uniform Item" : "Create Uniform Item"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Fill in item details, then add sizes and their corresponding prices.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Item Name *</Label>
                  <Input
                    value={editable.item_name}
                    onChange={(e) => patchEditable({ item_name: e.target.value })}
                    placeholder="e.g. School Polo Shirt"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Category *</Label>
                  <Select
                    value={editable.item_group}
                    onValueChange={(v) => handleCategoryChange(v as ItemGroup)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_GROUPS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Gender</Label>
                  <Select
                    value={editable.applicable_gender}
                    onValueChange={(v) => patchEditable({ applicable_gender: v as Gender })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_pair"
                    checked={editable.is_pair}
                    onCheckedChange={(v) => patchEditable({ is_pair: v })}
                  />
                  <Label htmlFor="is_pair" className="text-sm cursor-pointer">
                    Sold as a pair (Shirt + Pants)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="allow_half"
                    checked={editable.allow_half_price}
                    onCheckedChange={(v) => patchEditable({ allow_half_price: v })}
                  />
                  <Label htmlFor="allow_half" className="text-sm cursor-pointer">
                    Allow half-price option
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active_sw"
                    checked={editable.is_active}
                    onCheckedChange={(v) => patchEditable({ is_active: v })}
                  />
                  <Label htmlFor="is_active_sw" className="text-sm cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>

              {/* Applicable levels */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">
                  Applicable Year Levels{" "}
                  <span className="normal-case text-slate-400 font-normal">(leave blank for all)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {YEAR_LEVELS.map((lvl) => {
                    const selected = editable.applicable_levels.includes(lvl);
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => toggleLevel(lvl)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-all ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sizes & Prices */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">
                  {editable.item_group === "Others" ? "Price *" : "Sizes & Prices *"}
                </Label>

                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                  {editable.item_group !== "Others" && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">Select Sizes</p>
                      <div className="flex flex-wrap gap-2">
                        {SIZE_OPTIONS.map((size) => {
                          const selected = selectedSizes.includes(size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => toggleSizeSelection(size)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-all ${
                                selected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={`grid gap-3 ${editable.allow_half_price ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
                    <div>
                      <Label className="text-xs">Price (₱)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={batchPrice}
                        onChange={(e) => setBatchPrice(e.target.value)}
                        placeholder={editable.item_group === "Others" ? "Enter price (e.g., 50.00)" : "0.00"}
                        className="h-8 text-sm mt-1"
                      />
                    </div>

                    {editable.allow_half_price && (
                      <div>
                        <Label className="text-xs">Half Price (₱)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={batchHalfPrice}
                          readOnly
                          placeholder="Auto (50% of price)"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                    )}

                    {editable.item_group !== "Others" && (
                      <div className="flex items-end">
                        <p className="text-xs text-slate-500 w-full text-right">
                          Selected sizes auto-update with this price
                        </p>
                      </div>
                    )}
                    
                    {editable.item_group === "Others" && (
                      <div className="flex items-end">
                        <p className="text-xs text-slate-500 w-full text-left">
                          No sizes needed for this category
                        </p>
                      </div>
                    )}
                  </div>

                  {editable.item_group !== "Others" && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">Configured Sizes</p>
                      {editable.prices.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No sizes added yet</p>
                      ) : (
                      <div className="flex flex-wrap gap-2">
                        {editable.prices
                          .slice()
                          .sort((a, b) => SIZE_OPTIONS.indexOf(a.size) - SIZE_OPTIONS.indexOf(b.size))
                          .map((row) => (
                            <div
                              key={row.id || row.size}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
                            >
                              <span className="text-xs font-semibold">{row.size}</span>
                              <span className="text-xs text-slate-600">₱{Number(row.price || 0).toLocaleString()}</span>
                              {editable.allow_half_price && row.half_price !== "" && (
                                <span className="text-xs text-slate-500">½ ₱{Number(row.half_price).toLocaleString()}</span>
                              )}
                              <button
                                type="button"
                                title="Remove size"
                                onClick={() => removeConfiguredSize(row.size)}
                                className="text-red-500 hover:text-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={closeEditor} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="font-semibold">
                {saving ? "Saving..." : editable.id ? "Update Item" : "Create Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation Dialog ── */}
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-600">Delete Uniform Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.item_name}</strong>? All associated size/price entries will also be removed. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!deleteTarget) return;
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  await handleDelete(target);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </DashboardLayout>
    </FeatureGate>
  );
};

export default UniformManagement;
