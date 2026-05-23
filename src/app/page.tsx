'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Package, Warehouse, ShoppingCart, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface WarehouseData {
  id: string;
  name: string;
  location: string;
}

interface InventoryData {
  id: string;
  totalUnits: number;
  reservedUnits: number;
  warehouse: WarehouseData;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  inventories: InventoryData[];
}

interface ActiveReservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  expiresAt: string;
  productName: string;
  warehouseName: string;
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // Selected warehouse mapped by productId
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({});
  // Selected quantities mapped by productId
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  // Active reservation transaction tracking state
  const [activeReservation, setActiveReservation] = useState<ActiveReservation | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Fetch real-time metrics safely without a dependency loop
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch inventory status');
      const data = await res.json();
      setProducts(data);
      
      // Update warehouse selections safely using functional updates
      setSelectedWarehouses((prev) => {
        const updated = { ...prev };
        data.forEach((p: Product) => {
          if (!updated[p.id] && p.inventories.length > 0) {
            updated[p.id] = p.inventories[0].warehouse.id;
          }
        });
        return updated;
      });

      // Update quantity selections safely using functional updates
      setQuantities((prev) => {
        const updated = { ...prev };
        data.forEach((p: Product) => {
          if (!updated[p.id]) {
            updated[p.id] = 1;
          }
        });
        return updated;
      });
      
    } catch (error) {
      console.error(error);
      toast.error('Could not refresh latest stock allocations.');
    } finally {
      setLoading(false);
    }
  }, []); // Empty array completely isolates this callback

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle active client-side countdown ticking down
  useEffect(() => {
    if (!activeReservation) return;

    const calculateTimeLeft = () => {
      const difference = new Date(activeReservation.expiresAt).getTime() - Date.now();
      if (difference <= 0) {
        setActiveReservation(null);
        toast.error('Reservation checkout window expired!', {
          description: 'The stock has been securely put back into the inventory pool.',
        });
        fetchData();
        return;
      }
      setTimeLeft(Math.floor(difference / 1000));
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [activeReservation, fetchData]);

  // Action: Create Holding Reservation
  const handleReserve = async (product: Product) => {
    const warehouseId = selectedWarehouses[product.id];
    const quantity = quantities[product.id] || 1;
    const selectedInv = product.inventories.find(i => i.warehouse.id === warehouseId);
    const warehouseName = selectedInv?.warehouse.name || 'Selected Warehouse';

    setSubmitting(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, warehouseId, quantity }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error('Reservation Conflict (409)', {
            description: data.error || 'The requested units are no longer available. Try a smaller amount or another hub.',
          });
        } else {
          toast.error('Reservation Failed', { description: data.error });
        }
        fetchData();
        return;
      }

      setActiveReservation({
        ...data,
        productName: product.name,
        warehouseName,
      });
      toast.success('Inventory units held locked! 🌱', {
        description: `${quantity} unit(s) reserved. Complete your checkout within 10 minutes.`,
      });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Network mistake trying to connect to reservation service.');
    } finally {
      setSubmitting(false);
    }
  };

  // Action: Confirm Purchase Settlement
  const handleConfirm = async () => {
    if (!activeReservation) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/reservations/${activeReservation.id}/confirm`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          toast.error('Hold Expired (410)', { description: data.error });
        } else {
          toast.error('Confirmation Failed', { description: data.error });
        }
        setActiveReservation(null);
        fetchData();
        return;
      }

      toast.success('Order Successfully Placed! 🎉', {
        description: 'Inventory permanently deducted and stock registers cleared.',
      });
      setActiveReservation(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Error confirming your order.');
    } finally {
      setSubmitting(false);
    }
  };

  // Action: Cancel Hold Early
  const handleRelease = async () => {
    if (!activeReservation) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/reservations/${activeReservation.id}/release`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error('Release Refused', { description: data.error });
        return;
      }

      toast.info('Reservation Released', {
        description: 'Stock returned safely to the public warehouse allocations.',
      });
      setActiveReservation(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Error releasing your allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <p className="text-slate-400 font-medium">Reading baseline asset stock profiles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upper Brand Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            Allo StockLock Engine
          </h1>
          <p className="text-slate-400 mt-1">
            Distributed multi-warehouse atomic inventory checkout control panel.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="px-4 py-2 text-sm font-semibold bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition text-slate-300"
        >
          Sync Registers
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Products Grid Column */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
            <Package className="h-5 w-5 text-indigo-400" /> Live Product Matrix
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map((product) => {
              const currentWarehouseId = selectedWarehouses[product.id];
              const activeInventory = product.inventories.find(
                (i) => i.warehouse.id === currentWarehouseId
              );
              const availableUnits = activeInventory 
                ? activeInventory.totalUnits - activeInventory.reservedUnits 
                : 0;

              return (
                <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xl space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded">
                        {product.sku}
                      </span>
                      <span className="text-lg font-bold text-emerald-400">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{product.name}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2">{product.description}</p>
                  </div>

                  {/* Hub Logistics Block */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Warehouse className="h-3.5 w-3.5" /> Dispatch Hub:
                      </label>
                      <select
                        value={currentWarehouseId || ''}
                        onChange={(e) => setSelectedWarehouses({ ...selectedWarehouses, [product.id]: e.target.value })}
                        disabled={!!activeReservation || submitting}
                        className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                      >
                        {product.inventories.map((inv) => (
                          <option key={inv.warehouse.id} value={inv.warehouse.id}>
                            {inv.warehouse.name} ({inv.warehouse.location})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-between text-xs pt-1 border-t border-slate-900">
                      <span className="text-slate-500">Available Pool:</span>
                      <span className={`font-bold ${availableUnits > 0 ? 'text-slate-300' : 'text-rose-400'}`}>
                        {availableUnits > 0 ? `${availableUnits} units` : 'Out of stock'}
                      </span>
                    </div>
                  </div>

                  {/* Order Request Actions */}
                  <div className="flex gap-2 items-center pt-2">
                    <div className="w-1/4">
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, availableUnits)}
                        value={quantities[product.id] || 1}
                        disabled={availableUnits === 0 || !!activeReservation || submitting}
                        onChange={(e) => setQuantities({ ...quantities, [product.id]: parseInt(e.target.value) || 1 })}
                        className="w-full bg-slate-950 border border-slate-800 text-center rounded-lg py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                      />
                    </div>
                    <button
                      onClick={() => handleReserve(product)}
                      disabled={availableUnits === 0 || !!activeReservation || submitting}
                      className="w-3/4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 font-semibold py-2 px-4 rounded-lg text-sm transition shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                      Lock Reservation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Interactive Checkout Transaction Sidebar */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-400" /> Transaction Window
          </h2>

          {!activeReservation ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-2">
              <p className="text-slate-400 font-medium">No units held under lock</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Select an item matrix node and claim a temporal ticket lock to open transactional settlement options.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border-2 border-indigo-500 rounded-xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-900 px-2 py-1 rounded">
                  Pending Lease Ticket
                </span>
                <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold bg-amber-950/40 border border-amber-900 px-2.5 py-1 rounded-lg">
                  <Clock className="h-4 w-4 animate-pulse" />
                  {formatTime(timeLeft)}
                </div>
              </div>

              <div className="space-y-4 border-y border-slate-800 py-4">
                <div>
                  <label className="text-xs text-slate-500 block uppercase font-semibold">Allocated Line SKU</label>
                  <p className="font-bold text-white text-base mt-0.5">{activeReservation.productName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 block uppercase font-semibold">Origin Hub</label>
                    <p className="text-sm font-medium text-slate-300 mt-0.5">{activeReservation.warehouseName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block uppercase font-semibold">Quantity Checked</label>
                    <p className="text-sm font-bold text-slate-300 mt-0.5">{activeReservation.quantity} unit(s)</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Purchase Settlement
                </button>
                <button
                  onClick={handleRelease}
                  disabled={submitting}
                  className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 text-slate-400 hover:text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel & Release Units
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
