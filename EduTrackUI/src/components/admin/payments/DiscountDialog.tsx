import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Tag, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Discount {
  id: number;
  discount_name: string;
  discount_type: 'Percentage' | 'Fixed Amount';
  discount_value: number;
  is_active: number;
  year_levels: string;
  applicable_fees: string;
}

interface AppliedDiscount {
  id: number;
  discount_id: number;
  discount_name: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  applied_at: string;
}

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: number;
    student_id: number;
    enrollment_id?: number;
    payment_type: string;
    amount: number;
    total_discount?: number;
    net_amount?: number;
  };
  onDiscountsUpdated: (discounts?: any[]) => void;
  excludeDiscountNames?: string[]; // Optional: exclude specific discount names (e.g., "Full Payment Discount")
}

export default function DiscountDialog({
  open,
  onOpenChange,
  payment,
  onDiscountsUpdated,
  excludeDiscountNames = [],
}: DiscountDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<number[]>([]);
  const [calculatedTotal, setCalculatedTotal] = useState(0);

  // Fetch available and applied discounts
  useEffect(() => {
    if (open && payment) {
      fetchDiscounts();
      fetchAppliedDiscounts();
    }
  }, [open, payment]);

  // Calculate total discount when selections change
  useEffect(() => {
    calculateTotalDiscount();
  }, [selectedDiscountIds, availableDiscounts, payment.amount]);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/payments/applicable-discounts?student_id=${payment.student_id}&payment_type=${encodeURIComponent(payment.payment_type)}`
      );
      const data = await response.json();
      if (data.success) {
        // Filter out excluded discount names if specified
        const allDiscounts = data.data || [];
        const filteredDiscounts = excludeDiscountNames.length > 0
          ? allDiscounts.filter((d: Discount) => 
              !excludeDiscountNames.some(excludedName => 
                d.discount_name.toLowerCase().includes(excludedName.toLowerCase())
              )
            )
          : allDiscounts;
        setAvailableDiscounts(filteredDiscounts);
      }
    } catch (error) {
      console.error('Error fetching discounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available discounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAppliedDiscounts = async () => {
    try {
      const response = await fetch(`/api/payments/${payment.id}/discounts`);
      const data = await response.json();
      if (data.success) {
        const applied = (data.data || []) as AppliedDiscount[];
        setAppliedDiscounts(applied);

        // Try to map applied discounts to template IDs; if discount_id is null,
        // fall back to finding by name in availableDiscounts to avoid duplicate apply attempts.
        const mappedIds = applied
          .map((d) => {
            const numericId = Number(d.discount_id);
            if (!Number.isNaN(numericId)) return numericId;
            const byName = availableDiscounts.find((a) => a.discount_name === d.discount_name);
            return byName ? byName.id : NaN;
          })
          .filter((id) => !Number.isNaN(id));

        setSelectedDiscountIds(mappedIds);
      }
    } catch (error) {
      console.error('Error fetching applied discounts:', error);
    }
  };

  const calculateTotalDiscount = () => {
    let total = 0;
    selectedDiscountIds.forEach((discountId) => {
      const discount = availableDiscounts.find((d) => d.id === discountId);
      if (discount) {
        if (discount.discount_type === 'Percentage') {
          total += (payment.amount * discount.discount_value) / 100;
        } else {
          total += Math.min(discount.discount_value, payment.amount);
        }
      }
    });
    setCalculatedTotal(total);
  };

  const toggleDiscount = (discountId: number) => {
    setSelectedDiscountIds((prev) =>
      prev.includes(discountId)
        ? prev.filter((id) => id !== discountId)
        : [...prev, discountId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Special handling for enrollment discounts (payment.id === 0 means no payment record yet)
      if (payment.id === 0) {
        if (!payment.enrollment_id) {
          throw new Error('Payment is not linked to an enrollment');
        }

        // Calculate discount amounts for enrollment discounts
        const appliedDiscountsList = [];
        for (const discountId of selectedDiscountIds) {
          const discount = availableDiscounts.find((d) => d.id === discountId);
          if (discount) {
            const discountAmount = discount.discount_type === 'Percentage' 
              ? (payment.amount * discount.discount_value) / 100 
              : discount.discount_value;
            
            const enrollmentDiscountData = {
              discount_template_id: discount.id,
              discount_name: discount.discount_name,
              discount_type: discount.discount_type,
              discount_value: discount.discount_value,
              discount_amount: discountAmount,
              payment_id: null, // No payment yet
              notes: `Applied via admin discount management (pending payment)`
            };

            console.log('Creating enrollment discount:', enrollmentDiscountData);

            const res = await fetch(`/api/enrollments/${payment.enrollment_id}/discounts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(enrollmentDiscountData),
            });
            
            const data = await res.json();
            console.log('Enrollment discount response:', data);
            if (!data?.success) {
              throw new Error(data?.message || 'Failed to apply enrollment discount');
            }

            appliedDiscountsList.push({
              discount_id: discount.id,
              discount_name: discount.discount_name,
              discount_type: discount.discount_type,
              discount_value: discount.discount_value,
              value_type: discount.discount_type,
              applied_amount: discountAmount
            });
          }
        }

        toast({
          title: 'Success',
          description: 'Enrollment discounts applied successfully',
        });
        onDiscountsUpdated(appliedDiscountsList);
        onOpenChange(false);
        setSaving(false);
        return;
      }

      // Normal payment discount flow (payment.id > 0)
      // Determine which discounts to add and remove
      const currentIds = appliedDiscounts
        .map((d) => {
          const numericId = Number(d.discount_id);
          if (!Number.isNaN(numericId)) return numericId;
          const byName = availableDiscounts.find((a) => a.discount_name === d.discount_name);
          return byName ? byName.id : NaN;
        })
        .filter((id) => !Number.isNaN(id));
      const toAdd = selectedDiscountIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !selectedDiscountIds.includes(id));

      // Remove discounts
      for (const discountId of toRemove) {
        const res = await fetch(`/api/payments/${payment.id}/discounts/${discountId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!data?.success) {
          throw new Error(data?.message || 'Failed to remove discount');
        }
      }

      // Add new discounts
      for (const discountId of toAdd) {
        const discount = availableDiscounts.find((d) => d.id === discountId);
        if (discount) {
          const res = await fetch(`/api/payments/${payment.id}/discounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              discount_id: discountId,
              original_amount: payment.amount,
            }),
          });
          const data = await res.json();
          if (!data?.success) {
            throw new Error(data?.message || 'Failed to apply discount');
          }
        }
      }

      // Recalculate totals
      const recalcRes = await fetch(`/api/payments/${payment.id}/recalculate`, {
        method: 'PUT',
      });
      const recalcData = await recalcRes.json();
      if (!recalcData?.success) {
        throw new Error(recalcData?.message || 'Failed to recalculate totals');
      }

      // If this is a full tuition payment with discounts applied, also create enrollment discount record
      if (payment.payment_type === 'Tuition Full Payment' && payment.enrollment_id && recalcData?.total_discount > 0) {
        console.log('Creating enrollment discount records for payment:', payment.id, 'enrollment:', payment.enrollment_id);
        try {
          // Get the applied discounts to create enrollment discount records
          const discountsRes = await fetch(`/api/payments/${payment.id}/discounts`);
          const discountsData = await discountsRes.json();
          
          if (discountsData?.success && discountsData?.data?.length > 0) {
            console.log('Found applied discounts:', discountsData.data);
            // Create enrollment discount records for each applied discount
            for (const appliedDiscount of discountsData.data) {
              const enrollmentDiscountData = {
                discount_template_id: appliedDiscount.discount_id,
                discount_name: appliedDiscount.discount_name,
                discount_type: appliedDiscount.discount_type,
                discount_value: appliedDiscount.discount_value,
                discount_amount: appliedDiscount.discount_amount,
                payment_id: payment.id,
                notes: `Applied via admin discount management`
              };

              console.log('Creating enrollment discount:', enrollmentDiscountData);
              const enrollmentRes = await fetch(`/api/enrollments/${payment.enrollment_id}/discounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enrollmentDiscountData),
              });
              
              const enrollmentData = await enrollmentRes.json();
              console.log('Enrollment discount creation result:', enrollmentData);
              // Don't fail the whole operation if enrollment discount creation fails
            }
          } else {
            console.log('No applied discounts found or API failed:', discountsData);
          }
        } catch (enrollmentError) {
          console.error('Error creating enrollment discount records:', enrollmentError);
          // Don't fail the payment discount operation if enrollment discount creation fails
        }
      } else {
        console.log('Skipping enrollment discount creation. Payment type:', payment.payment_type, 'Enrollment ID:', payment.enrollment_id, 'Total discount:', recalcData?.total_discount);
      }

      toast({
        title: 'Success',
        description: 'Discounts updated successfully',
      });
      
      // Fetch the updated discounts to pass to the callback
      try {
        const updatedDiscountsRes = await fetch(`/api/payments/${payment.id}/discounts`);
        const updatedDiscountsData = await updatedDiscountsRes.json();
        const discountsList = updatedDiscountsData?.success && updatedDiscountsData?.data 
          ? updatedDiscountsData.data.map((d: any) => ({
              discount_id: d.discount_id,
              discount_name: d.discount_name,
              discount_type: d.discount_type,
              discount_value: d.discount_value,
              value_type: d.value_type,
              applied_amount: d.discount_amount
            }))
          : [];
        onDiscountsUpdated(discountsList);
      } catch (e) {
        console.error('Error fetching updated discounts:', e);
        onDiscountsUpdated([]);
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating discounts:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update discounts',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const getDiscountDisplay = (discount: Discount) => {
    if (discount.discount_type === 'Percentage') {
      return `${discount.discount_value}% off`;
    }
    return `${formatAmount(discount.discount_value)} off`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Manage Discounts
          </DialogTitle>
          <DialogDescription>
            Apply or remove discounts for this payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Type:</span>
              <span className="font-medium">{payment.payment_type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Amount:</span>
              <span className="font-medium">{formatAmount(payment.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Discount:</span>
              <span className="font-medium text-green-600">
                -{formatAmount(calculatedTotal)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold">Net Amount:</span>
              <span className="font-semibold text-lg">
                {formatAmount(payment.amount - calculatedTotal)}
              </span>
            </div>
          </div>

          {/* Applied Discounts */}
          {appliedDiscounts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Currently Applied:</h4>
              <div className="flex flex-wrap gap-2">
                {appliedDiscounts.map((discount) => (
                  <Badge key={discount.id} variant="secondary" className="gap-1">
                    {discount.discount_name}
                    <span className="text-xs">
                      (-{formatAmount(discount.discount_amount)})
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Available Discounts */}
          <div>
            <h4 className="text-sm font-medium mb-3">Available Discounts:</h4>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableDiscounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="text-sm">No discounts available for this payment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableDiscounts.map((discount) => {
                  const isSelected = selectedDiscountIds.includes(discount.id);
                  const calculatedAmount =
                    discount.discount_type === 'Percentage'
                      ? (payment.amount * discount.discount_value) / 100
                      : Math.min(discount.discount_value, payment.amount);

                  return (
                    <div
                      key={discount.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleDiscount(discount.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDiscount(discount.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{discount.discount_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {getDiscountDisplay(discount)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-green-600">
                            -{formatAmount(calculatedAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
