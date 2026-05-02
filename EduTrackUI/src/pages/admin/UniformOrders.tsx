import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { Plus, Shirt, ShoppingBag, QrCode, Loader2, CheckCircle, Coins, Package, Clock, Trash2 } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";

type UniformPrice = {
  id: string;
  size: string;
  price: number;
  half_price: number | null;
  is_active: boolean | number;
};

type UniformItem = {
  id: string;
  item_name: string;
  item_group: string;
  is_pair: boolean;
  allow_half_price: boolean;
  is_active: boolean;
  prices: UniformPrice[];
};

type StudentOption = {
  user_id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
};

type UniformOrder = {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  student_number?: string;
  item_name: string;
  item_group: string;
  size: string;
  quantity: string;
  unit_price: string;
  total_amount: string;
  receipt_number?: string;
  payment_status?: string;
  payment_method?: string;
  payment_date?: string;
  is_half_piece?: string | boolean | number;
  piece_type?: string;
  created_at: string;
};

type GroupedUniformPrice = UniformPrice & {
  source_item_id: string;
};

type GroupedUniformItem = {
  key: string;
  item_name: string;
  item_group: string;
  is_pair: boolean;
  allow_half_price: boolean;
  is_active: boolean;
  prices: GroupedUniformPrice[];
};

type CartOrderItem = {
  line_id: string;
  uniform_item_id: number;
  item_name: string;
  item_group: string;
  size: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_half_piece: boolean;
  piece_type?: "Shirt" | "Pants";
};

const PAYMENT_METHODS = ["Cash", "GCash", "Bank Transfer", "Check", "PayMaya", "Others"];

const UniformOrders = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // GCash QR session state
  const [gcashToken, setGcashToken] = useState<string | null>(null);
  const [gcashSessionLoading, setGcashSessionLoading] = useState(false);
  const [gcashProofReceived, setGcashProofReceived] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");

  const [orders, setOrders] = useState<UniformOrder[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [uniformItems, setUniformItems] = useState<UniformItem[]>([]);

  const [studentId, setStudentId] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [uniformItemId, setUniformItemId] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isHalfPiece, setIsHalfPiece] = useState(false);
  const [pieceType, setPieceType] = useState<"Shirt" | "Pants">("Shirt");
  const [cartItems, setCartItems] = useState<CartOrderItem[]>([]);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, studentsRes, itemsRes] = await Promise.all([
        apiGet(API_ENDPOINTS.UNIFORM_ORDERS),
        apiGet(API_ENDPOINTS.STUDENTS),
        apiGet(API_ENDPOINTS.UNIFORM_ITEMS),
      ]);

      setOrders(Array.isArray(ordersRes?.data) ? ordersRes.data : []);
      setStudents(Array.isArray(studentsRes?.data) ? studentsRes.data : []);
      setUniformItems(Array.isArray(itemsRes?.data) ? itemsRes.data : []);
    } catch (error: any) {
      showAlert("error", error?.message || "Failed to load uniform orders data");
      setOrders([]);
      setStudents([]);
      setUniformItems([]);
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

  const groupedUniformItems = useMemo<GroupedUniformItem[]>(() => {
    const map = new Map<string, GroupedUniformItem>();

    uniformItems.forEach((item) => {
      if (!item.is_active) return;

      const key = `${item.item_name}||${item.item_group}`;
      const existing = map.get(key);

      const pricesWithSource: GroupedUniformPrice[] = (item.prices || []).map((price) => ({
        ...price,
        source_item_id: String(item.id),
      }));

      if (!existing) {
        map.set(key, {
          key,
          item_name: item.item_name,
          item_group: item.item_group,
          is_pair: item.is_pair,
          allow_half_price: item.allow_half_price,
          is_active: item.is_active,
          prices: pricesWithSource,
        });
        return;
      }

      existing.allow_half_price = existing.allow_half_price || item.allow_half_price;
      existing.is_pair = existing.is_pair || item.is_pair;
      existing.prices = [...existing.prices, ...pricesWithSource];
    });

    return Array.from(map.values()).map((group) => {
      // Deduplicate by size inside grouped display; keep most recent price row id
      const bySize = new Map<string, GroupedUniformPrice>();
      [...group.prices]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .forEach((p) => {
          if (!bySize.has(p.size)) {
            bySize.set(p.size, p);
          }
        });

      return {
        ...group,
        prices: Array.from(bySize.values()),
      };
    });
  }, [uniformItems]);

  const selectedItem = useMemo(
    () => groupedUniformItems.find((item) => item.key === uniformItemId),
    [groupedUniformItems, uniformItemId]
  );

  const sizeOptions = useMemo(() => {
    if (!selectedItem) return [];
    return selectedItem.prices.filter((price) => Number(price.is_active) === 1);
  }, [selectedItem]);

  const filteredStudentSuggestions = useMemo(() => {
    if (!studentSearchQuery.trim()) return [];
    const query = studentSearchQuery.toLowerCase();
    return students
      .filter((student) => {
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        const studentNumber = (student.student_id || "").toLowerCase();
        return fullName.includes(query) || studentNumber.includes(query);
      })
      .slice(0, 10);
  }, [students, studentSearchQuery]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.user_id === studentId),
    [students, studentId]
  );

  const selectedPrice = useMemo(() => {
    if (!selectedItem || !size) return null;
    return selectedItem.prices.find((price) => price.size === size);
  }, [selectedItem, size]);

  const currentLineTotal = useMemo(() => {
    if (!selectedPrice) return 0;
    const unitPrice = isHalfPiece 
      ? (selectedPrice.half_price || selectedPrice.price)
      : selectedPrice.price;
    return Number(unitPrice) * Number(quantity);
  }, [selectedPrice, isHalfPiece, quantity]);

  const transactionTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.total_amount), 0),
    [cartItems]
  );

  const canAddCurrentItem = useMemo(() => {
    const qty = Number(quantity);
    return Boolean(studentId && uniformItemId && size && Number.isInteger(qty) && qty > 0);
  }, [studentId, uniformItemId, size, quantity]);

  const resetForm = () => {
    setStudentId("");
    setStudentSearchQuery("");
    setShowStudentSuggestions(false);
    setUniformItemId("");
    setSize("");
    setQuantity("1");
    setPaymentMethod("Cash");
    setIsHalfPiece(false);
    setPieceType("Shirt");
    setCartItems([]);
    setGcashToken(null);
    setGcashProofReceived(false);
    setReferenceNumber("");
  };

  const resetItemBuilder = () => {
    setUniformItemId("");
    setSize("");
    setQuantity("1");
    setIsHalfPiece(false);
    setPieceType("Shirt");
  };

  const handleAddItemToCart = () => {
    if (!studentId) {
      showAlert("error", "Please select a student first");
      return;
    }

    if (!uniformItemId || !size || !quantity) {
      showAlert("error", "Please select item, size, and quantity before adding");
      return;
    }

    if (!selectedItem || !selectedPrice) {
      showAlert("error", "Selected uniform item or size is invalid");
      return;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      showAlert("error", "Quantity must be a whole number greater than 0");
      return;
    }

    const unitPrice = isHalfPiece
      ? Number(selectedPrice.half_price || selectedPrice.price)
      : Number(selectedPrice.price);

    const lineItem: CartOrderItem = {
      line_id: `${selectedPrice.source_item_id}-${selectedPrice.size}-${Date.now()}`,
      uniform_item_id: Number(selectedPrice.source_item_id),
      item_name: selectedItem.item_name,
      item_group: selectedItem.item_group,
      size,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: unitPrice * qty,
      is_half_piece: isHalfPiece,
      piece_type: isHalfPiece ? pieceType : undefined,
    };

    setCartItems((prev) => [...prev, lineItem]);
    resetItemBuilder();
  };

  const handleRemoveCartItem = (lineId: string) => {
    setCartItems((prev) => prev.filter((item) => item.line_id !== lineId));
  };

  const handleOpenGcashQr = async () => {
    if (!studentId) {
      showAlert("error", "Please select a student first");
      return;
    }

    if (cartItems.length === 0 || transactionTotal <= 0) {
      showAlert("error", "Add at least one item before opening GCash QR uploader");
      return;
    }

    setGcashSessionLoading(true);
    setGcashProofReceived(false);
    try {
      const res = await apiPost(API_ENDPOINTS.GCASH_SESSIONS, {
        user_id: studentId,
        amount_due: transactionTotal,
        payment_description: `Uniform order (${cartItems.length} item${cartItems.length > 1 ? 's' : ''})`
      });
      if (res.success && res.token) {
        setGcashToken(res.token);
        window.open(`${import.meta.env.BASE_URL}admin/gcash-session/${res.token}`, '_blank');
      } else {
        showAlert("error", res.message || 'Failed to create GCash session');
      }
    } catch {
      showAlert("error", 'Failed to create GCash session');
    } finally {
      setGcashSessionLoading(false);
    }
  };

  useEffect(() => {
    if (!gcashToken) return;
    const handler = (e: StorageEvent) => {
      if (e.key === `gcash_proof_${gcashToken}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.ocr_reference) {
            setReferenceNumber(data.ocr_reference);
          }
          setGcashProofReceived(true);
        } catch {}
        localStorage.removeItem(`gcash_proof_${gcashToken}`);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [gcashToken]);

  const handleCreateOrder = async () => {
    if (!studentId) {
      showAlert("error", "Please select a student");
      return;
    }

    if (cartItems.length === 0) {
      showAlert("error", "Please add at least one uniform item");
      return;
    }

    if (paymentMethod === "GCash" && !referenceNumber.trim()) {
      showAlert("error", "GCash reference number is required for GCash payments");
      return;
    }

    // Show confirmation
    const studentName = selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}${selectedStudent.student_id ? ` (${selectedStudent.student_id})` : ""}` : "-";
    const itemsSummary = cartItems
      .map((item, index) => `${index + 1}. ${item.item_name}${item.is_half_piece && item.piece_type ? ` (${item.piece_type})` : ""} - ${item.size} x${item.quantity}`)
      .join("\n");
    
    const confirmed = await confirm({
      title: "Confirm Uniform Order Transaction",
      description: (
        `Create uniform order transaction for:\n\n` +
        `👤 Student: ${studentName}\n\n` +
        `📦 Items:\n${itemsSummary}\n\n` +
        `💳 Payment Method: ${paymentMethod}${paymentMethod === "GCash" && referenceNumber ? ` (Ref: ${referenceNumber})` : ""}\n\n` +
        `💰 Total Amount: ₱${transactionTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n\n` +
        `✅ One payment record will be created for all selected items.`
      ),
      confirmText: "Create Transaction",
      cancelText: "Cancel"
    });

    if (!confirmed) return;

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        student_id: Number(studentId),
        payment_method: paymentMethod,
        items: cartItems.map((item) => ({
          uniform_item_id: item.uniform_item_id,
          size: item.size,
          quantity: item.quantity,
          is_half_piece: item.is_half_piece,
          piece_type: item.is_half_piece ? item.piece_type : undefined,
        })),
      };

      if (paymentMethod === "GCash" && referenceNumber) {
        payload.reference_number = referenceNumber;
      }

      const res = await apiPost(`${API_ENDPOINTS.UNIFORM_ORDERS}/batch`, payload);
      if (!res?.success) {
        throw new Error(res?.message || "Failed to create uniform order transaction");
      }

      showAlert("success", "Uniform transaction created and payment record generated");
      setIsCreateOpen(false);
      resetForm();
      await fetchData();
    } catch (error: any) {
      showAlert("error", error?.message || "Failed to create uniform order transaction");
    } finally {
      setSaving(false);
    }
  };

  const getPaymentBadgeClass = (status?: string) => {
    if (status === "Approved") return "bg-green-100 text-green-800 border-green-300";
    if (status === "Pending") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (status === "Verified") return "bg-blue-100 text-blue-800 border-blue-300";
    if (status === "Rejected") return "bg-red-100 text-red-800 border-red-300";
    return "bg-muted text-muted-foreground";
  };

  const getOrderItemSuffix = (order: UniformOrder) => {
    const isHalfPiece = order.is_half_piece === 1 || order.is_half_piece === "1" || order.is_half_piece === true;
    const isPEUniform = (order.item_group || "").toLowerCase() === "pe" || (order.item_name || "").toLowerCase() === "pe uniform";

    if (isHalfPiece && order.piece_type) {
      return ` (${order.piece_type})`;
    }

    if (!isHalfPiece && isPEUniform) {
      return " (Pair)";
    }

    return "";
  };

  // Statistics
  const totalSales = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const totalOrders = orders.length;
  const approvedCount = orders.filter(o => o.payment_status === 'Approved').length;
  const pendingCount = orders.filter(o => o.payment_status === 'Pending').length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading uniform orders...</div>
      </DashboardLayout>
    );
  }

  return (
    <FeatureGate feature="payment" showComingSoon>
      <DashboardLayout>
        <div className="p-8 space-y-6">
        {alert && (
          <AlertMessage
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Uniform Orders
            </h1>
            <p className="text-muted-foreground">Create uniform orders and automatically log payment records.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200 hover:bg-slate-100"
              onClick={() => navigate("/admin/uniform-management")}
            >
              <Shirt className="h-4 w-4 mr-2" />
              Uniform Management
            </Button>

            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) {
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Uniform Order
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Uniform Order</DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-muted-foreground">1. Select Student</p>
                    {cartItems.length > 0 && (
                      <p className="text-xs text-amber-600 font-medium">🔒 Locked (items in cart)</p>
                    )}
                  </div>
                  <div className="relative">
                    <Label>Student *</Label>
                    <Input
                      className="mt-1"
                      placeholder="Search student by ID or name..."
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        setShowStudentSuggestions(true);
                        if (!e.target.value) {
                          setStudentId("");
                        }
                      }}
                      onFocus={() => setShowStudentSuggestions(true)}
                      onBlur={() => {
                        setTimeout(() => setShowStudentSuggestions(false), 200);
                      }}
                      disabled={cartItems.length > 0}
                    />
                    {showStudentSuggestions && filteredStudentSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredStudentSuggestions.map((student) => (
                          <button
                            key={student.user_id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setStudentId(student.user_id);
                              setStudentSearchQuery(
                                `${student.first_name} ${student.last_name}${student.student_id ? ` (${student.student_id})` : ""}`
                              );
                              setShowStudentSuggestions(false);
                            }}
                          >
                            <div className="font-medium">
                              {student.first_name} {student.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {student.student_id || "Enrollee"}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">2. Add Uniform Items</p>
                  {!studentId && (
                    <p className="text-xs text-amber-600 mb-3">Select a student first to enable item selection.</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Uniform Item *</Label>
                      <Select
                        value={uniformItemId}
                        onValueChange={(value) => {
                          setUniformItemId(value);
                          setSize("");
                          setIsHalfPiece(false);
                        }}
                        disabled={!studentId}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select uniform item" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupedUniformItems.map((item) => (
                            <SelectItem key={item.key} value={item.key}>
                              {item.item_name} ({item.item_group})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Size *</Label>
                      <Select value={size} onValueChange={setSize} disabled={!uniformItemId || !studentId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {sizeOptions.map((price) => (
                            <SelectItem key={price.id} value={price.size}>
                              {price.size} - ₱{Number(price.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                              {price.half_price ? ` (half: ₱${Number(price.half_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        min={1}
                        step={1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        disabled={!studentId}
                      />
                    </div>

                    {selectedItem?.allow_half_price && (
                      <>
                        <div>
                          <Label>Half Piece</Label>
                          <Select
                            value={isHalfPiece ? "yes" : "no"}
                            onValueChange={(value) => setIsHalfPiece(value === "yes")}
                            disabled={!studentId}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {isHalfPiece && (
                          <div>
                            <Label>Piece Type</Label>
                            <Select value={pieceType} onValueChange={(value: "Shirt" | "Pants") => setPieceType(value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Shirt">Shirt</SelectItem>
                                <SelectItem value="Pants">Pants</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-gray-200 p-3 bg-muted/20 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Current Item Total</p>
                      <p className="text-sm text-muted-foreground">
                        ₱{currentLineTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetItemBuilder}
                        disabled={!studentId}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAddItemToCart}
                        disabled={!canAddCurrentItem}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Item
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between">
                    <p className="font-medium">Items in This Transaction ({cartItems.length})</p>
                    <p className="font-semibold">₱{transactionTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No items added yet.</div>
                  ) : (
                    <div className="divide-y">
                      {cartItems.map((item) => (
                        <div key={item.line_id} className="p-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {item.item_name}
                              {item.is_half_piece && item.piece_type ? ` (${item.piece_type})` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.size} • Qty {item.quantity} • ₱{Number(item.unit_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })} each
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-semibold">₱{Number(item.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCartItem(item.line_id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground">3. Checkout</p>

                  <div>
                    <Label>Payment Method *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="mt-1 max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* GCash QR Uploader - Full width */}
                {paymentMethod === "GCash" && (
                    <div className="space-y-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-blue-700 mb-3 font-medium">
                        📱 Let the student upload their GCash screenshot by scanning a QR code
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                        onClick={handleOpenGcashQr}
                        disabled={gcashSessionLoading || !studentId || !transactionTotal || cartItems.length === 0}
                      >
                        {gcashSessionLoading
                          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating session…</>
                          : <><QrCode className="h-4 w-4 mr-2" />Open GCash QR Uploader</>}
                      </Button>
                      {(!studentId || !transactionTotal || cartItems.length === 0) && (
                        <p className="text-xs text-blue-600 mt-2 text-center">
                          Select a student and add at least one item to enable
                        </p>
                      )}
                      {gcashProofReceived && (
                        <div className="mt-3 flex items-center gap-2 text-green-700 text-sm font-medium">
                          <CheckCircle className="h-4 w-4" />
                          Proof received — reference auto-filled below
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>GCash Reference Number</Label>
                      <Input
                        className="mt-1 font-mono"
                        placeholder="Auto-filled from QR upload, or enter manually"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>
                )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateOrder} disabled={saving || cartItems.length === 0}>
                  {saving ? "Creating..." : "Create Transaction"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-semibold">Total Sales</p>
                  <p className="text-2xl font-bold text-blue-700">
                    ₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-semibold">Total Orders</p>
                  <p className="text-2xl font-bold text-purple-700">{totalOrders}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-semibold">Approved</p>
                  <p className="text-2xl font-bold text-green-700">{approvedCount}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-semibold">Pending</p>
                  <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-200 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Uniform Order Records ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{order.first_name} {order.last_name}</div>
                        {order.student_number && (
                          <div className="text-xs text-muted-foreground">{order.student_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Shirt className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {order.item_name}
                              {getOrderItemSuffix(order)}
                            </div>
                            <div className="text-xs text-muted-foreground">{order.item_group}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{order.size}</td>
                      <td className="px-6 py-4">{order.quantity}</td>
                      <td className="px-6 py-4">₱{Number(order.unit_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 font-semibold">₱{Number(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4">{order.receipt_number || "-"}</td>
                      <td className="px-6 py-4">
                        <Badge className={getPaymentBadgeClass(order.payment_status)}>
                          {order.payment_status || "Unpaid"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {orders.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  No uniform orders yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </DashboardLayout>
    </FeatureGate>
  );
};

export default UniformOrders;
