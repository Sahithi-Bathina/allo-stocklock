'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Package,
  Warehouse,
  ShoppingCart,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCcw,
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeReservation, setActiveReservation] = useState<ActiveReservation | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // ... inside your Dashboard component
  const fetchData = async () => {
  setLoading(true);
  try {
    const res = await fetch(`/api/products?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch products');
    }
    
    const data = await res.json();
    setProducts(data);

    // Initialize state
    const newWarehouses = { ...selectedWarehouses };
    const newQuantities: Record<string, number> = { ...quantities };
    
    data.forEach((p: Product) => {
      if (p.inventories.length > 0 && !newWarehouses[p.id]) {
        newWarehouses[p.id] = p.inventories[0].warehouse.id;
      }
      // Ensure quantity is set if not already present
      if (newQuantities[p.id] === undefined) {
        newQuantities[p.id] = 1;
      }
    });

    setSelectedWarehouses(newWarehouses);
    setQuantities(newQuantities);

  } catch (error) {
    console.error("Fetch error:", error);
    toast.error('Unable to refresh inventory');
  } finally {
    // THIS is the part that fixes the infinite loading spinner
    setLoading(false); 
  }
};
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!activeReservation) return;

    const calculateTimeLeft = () => {
      const difference = new Date(activeReservation.expiresAt).getTime() - Date.now();

      if (difference <= 0) {
        setActiveReservation(null);
        toast.error('Reservation expired');
        fetchData();
        return;
      }

      setTimeLeft(Math.floor(difference / 1000));
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [activeReservation]);

  const handleReserve = async (product: Product) => {
    const warehouseId = selectedWarehouses[product.id];
    const quantity = quantities[product.id] || 1;

    const selectedInventory = product.inventories.find(
      (i) => i.warehouse.id === warehouseId
    );

    const warehouseName = selectedInventory?.warehouse.name || 'Warehouse';
    setLoadingProductId(product.id);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId,
          quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Reservation failed');
        fetchData();
        return;
      }

      setActiveReservation({
        ...data.reservation,
        productName: product.name,
        warehouseName,
      });

      toast.success('Inventory reserved successfully');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to reserve inventory');
    } finally {
      setLoadingProductId(null);
    }
  };

  const handleConfirm = async () => {
    if (!activeReservation) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/reservations/${activeReservation.id}/confirm`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Confirmation failed');
        return;
      }

      toast.success('Purchase confirmed successfully');
      setActiveReservation(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Unable to confirm purchase');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!activeReservation) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/reservations/${activeReservation.id}/release`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Unable to release reservation');
        return;
      }

      toast.success('Reservation released');
      setActiveReservation(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to release reservation');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white px-6 py-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Allo Inventory Reserve</h1>
            <p className="text-slate-400 mt-1">
              Real-time multi-warehouse inventory reservation platform.
            </p>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            className="px-4 py-2 text-sm font-semibold bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition text-slate-300 flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh Inventory
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Products */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
              <Package className="h-5 w-5 text-indigo-400" />
              Inventory Catalog
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

                const isThisProductReserved = activeReservation?.productId === product.id;

                return (
                  <div
                    key={product.id}
                    className={`border rounded-xl p-5 shadow-xl space-y-4 transition ${
                      isThisProductReserved
                        ? 'bg-slate-900 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded">
                          {product.sku}
                        </span>

                        <span className="text-lg font-bold text-emerald-400">
                          ${product.price ? product.price.toFixed(2) : '0.00'}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white">{product.name}</h3>
                      <p className="text-sm text-slate-400">{product.description}</p>
                    </div>

                    {/* Warehouse Selector */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                          <Warehouse className="h-3.5 w-3.5" />
                          Warehouse
                        </label>

                        <select
                          value={currentWarehouseId || ''}
                          onChange={(e) =>
                            setSelectedWarehouses({
                              ...selectedWarehouses,
                              [product.id]: e.target.value,
                            })
                          }
                          disabled={
                            !!activeReservation || loadingProductId === product.id
                          }
                          className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                        >
                          {product.inventories.map((inv) => (
                            <option key={inv.warehouse.id} value={inv.warehouse.id}>
                              {inv.warehouse.name} ({inv.warehouse.location})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex justify-between text-xs pt-1 border-t border-slate-900">
                        <span className="text-slate-500">Available Inventory</span>
                        <span className="font-bold text-slate-300">
                          {availableUnits} units
                        </span>
                      </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex gap-2 items-center pt-2">
                      <div className="w-1/4">
                        <input
                          type="number"
                          min="1"
                          max={Math.max(1, availableUnits)}
                          value={quantities[product.id] || 1}
                          disabled={
                            availableUnits === 0 ||
                            !!activeReservation ||
                            loadingProductId === product.id
                          }
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [product.id]: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-800 text-center rounded-lg py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <button
                        onClick={() => handleReserve(product)}
                        disabled={
                          availableUnits === 0 ||
                          loadingProductId === product.id ||
                          (!!activeReservation && !isThisProductReserved)
                        }
                        className={`w-3/4 font-semibold py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 ${
                          isThisProductReserved
                            ? 'bg-emerald-600 text-white cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500'
                        }`}
                      >
                        {loadingProductId === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}

                        {isThisProductReserved ? 'Units Locked' : 'Reserve Inventory'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Active Transaction Window */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-400" />
              Active Reservation
            </h2>

            {!activeReservation ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-2">
                <p className="text-slate-300 font-medium">No active reservations</p>
                <p className="text-xs text-slate-500">
                  Reserve inventory from any warehouse to begin checkout.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-indigo-500 rounded-xl p-6 space-y-6 shadow-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Reservation Active
                  </span>

                  <div className="flex items-center gap-2 text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    <Clock className="h-4 w-4 animate-pulse" />
                    {formatTime(timeLeft)}
                  </div>
                </div>

                <div className="space-y-4 border-t border-b border-slate-800 py-4">
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider">
                      Reserved Product
                    </label>
                    <p className="font-bold text-white text-lg">{activeReservation.productName}</p>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider">
                      Warehouse
                    </label>
                    <p className="text-slate-300">{activeReservation.warehouseName}</p>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider">
                      Quantity Ordered
                    </label>
                    <p className="text-emerald-400 font-mono font-bold text-md">
                      {activeReservation.quantity} unit(s)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleConfirm}
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Confirm Purchase
                  </button>

                  <button
                    onClick={handleRelease}
                    disabled={actionLoading}
                    className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Reservation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}