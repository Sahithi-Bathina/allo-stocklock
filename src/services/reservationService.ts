import { db } from '@/lib/db';
import { ReservationStatus } from '@prisma/client';

// 1. Declare the type at the top so it's universally accessible in this file
interface InventoryRow {
  id: string;
  totalUnits: number;
  reservedUnits: number;
}

export class ReservationService {
  /**
   * Concurrency-safe unit reservation using PostgreSQL Row-Level Locking (FOR UPDATE)
   */
  static async reserveProduct(productId: string, warehouseId: string, quantity: number) {
    return await db.$transaction(async (tx) => {
      // 1. Lock the inventory row for this specific product and warehouse combination.
      // This forces concurrent requests for the exact same SKU to queue up sequentially.
      const inventoryRows = await tx.$queryRaw<InventoryRow[]>`
        SELECT id, "totalUnits", "reservedUnits"
        FROM "Inventory"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        LIMIT 1
        FOR UPDATE
      `;

      const inventory = inventoryRows[0];

      if (!inventory) {
        throw new Error('Inventory allocation not found for the requested product and warehouse.');
      }

      // 2. Calculate actual real-time availability
      const availableStock = inventory.totalUnits - inventory.reservedUnits;

      // 3. Reject with a 409 status indicator if demand exceeds available units
      if (availableStock < quantity) {
        return { success: false, status: 409, message: 'Not enough available stock' };
      }

      // 4. Atomically increment the reserved units count on the locked row
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedUnits: {
            increment: quantity,
          },
        },
      });

      // 5. Generate the formal reservation tracking row with a firm 10-minute expiry window
      const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: ReservationStatus.PENDING,
          expiresAt: tenMinutesFromNow,
        },
      });

      return { success: true, status: 201, reservation };
    });
  }

  /**
   * Confirms an outstanding pending reservation after a successful checkout payment
   */
  static async confirmReservation(reservationId: string) {
    return await db.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        return { success: false, status: 404, message: 'Reservation not found' };
      }

      if (reservation.status === ReservationStatus.CONFIRMED) {
        return { success: true, status: 200, message: 'Reservation already confirmed' };
      }

      // Fail early with a 410 if the checkout window closed or was previously released
      if (reservation.status !== ReservationStatus.PENDING || new Date() > reservation.expiresAt) {
        // Explicitly update status to EXPIRED if it sat past its expiry time uncleaned
        if (reservation.status === ReservationStatus.PENDING) {
          await tx.reservation.update({
            where: { id: reservationId },
            data: { status: ReservationStatus.EXPIRED },
          });
        }
        return { success: false, status: 410, message: 'Reservation has expired or is invalid' };
      }

      // Permanent settlement: Lock down the inventory row to finalize the units decrement
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
      });

      if (inventory) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            totalUnits: { decrement: reservation.quantity },
            reservedUnits: { decrement: reservation.quantity },
          },
        });
      }

      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CONFIRMED },
      });

      return { success: true, status: 200, reservation: updatedReservation };
    });
  }

  /**
   * Releases an outstanding reservation early if payment fails or user cancels explicitly
   */
  static async releaseReservation(reservationId: string) {
    return await db.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        return { success: false, status: 404, message: 'Reservation not found' };
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        return { success: false, status: 400, message: 'Reservation cannot be released from its current state' };
      }

      // Return the held units back to the pool of available stock
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
      });

      if (inventory) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedUnits: { decrement: reservation.quantity },
          },
        });
      }

      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.RELEASED },
      });

      return { success: true, status: 200, reservation: updatedReservation };
    });
  }

  /**
   * Background cleanup worker: Finds and releases all uncompleted, expired reservations.
   * This should be triggered periodically by a cron job or background endpoint.
   */
  static async cleanupExpiredReservations() {
    try {
      const now = new Date();

      // 1. Find all pending reservations that have passed their expiration timestamp
      const expiredReservations = await db.reservation.findMany({
        where: {
          status: ReservationStatus.PENDING,
          expiresAt: { lt: now },
        },
      });

      if (expiredReservations.length === 0) {
        return { success: true, processedCount: 0 };
      }

      console.log(`[Cron Worker] Found ${expiredReservations.length} expired locks to release.`);

      // 2. Process each expired item inside a transaction block to safely restore stock
      for (const reservation of expiredReservations) {
        await db.$transaction(async (tx) => {
          // Double-check status inside the transaction block to avoid race conditions
          const currentRes = await tx.reservation.findUnique({
            where: { id: reservation.id },
          });

          if (currentRes && currentRes.status === ReservationStatus.PENDING) {
            // Revert the reservedUnits back to the warehouse available pool
            await tx.inventory.updateMany({
              where: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId,
              },
              data: {
                reservedUnits: { decrement: reservation.quantity },
              },
            });

            // Set final terminal state to EXPIRED
            await tx.reservation.update({
              where: { id: reservation.id },
              data: { status: ReservationStatus.EXPIRED },
            });
          }
        });
      }

      return { success: true, processedCount: expiredReservations.length };
    } catch (error) {
      console.error('[Cron Worker Failure] Failed to clear expired reservations:', error);
      return { success: false, error };
    }
  }
}
