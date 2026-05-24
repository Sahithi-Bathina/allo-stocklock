# Allo StockLock

> Atomic multi-warehouse inventory reservation platform built to prevent overselling and race conditions during concurrent checkout attempts.

---

## Live Demo

🔗 https://allo-stocklock.vercel.app/

## GitHub Repository

🔗 https://github.com/Sahithi-Bathina/allo-stocklock

---

# Problem Statement

Traditional inventory systems often fail during simultaneous checkout attempts, allowing multiple users to reserve the same inventory at the same time.

This project solves that problem using:

- Atomic inventory reservation workflows
- Transaction-safe stock updates
- Warehouse-level inventory management
- Reservation expiration recovery
- Concurrent booking protection

The system ensures inventory consistency even when multiple users attempt to reserve limited stock simultaneously.

---

# Features

## Atomic Reservation Locking
Prevents overselling using transactional reservation logic.

## Multi-Warehouse Inventory
Each product can exist across multiple warehouse locations with independent stock tracking.

## Concurrent Booking Protection
Only one user can reserve the same inventory unit at a time.

## Reservation Expiration System
Expired reservations automatically release inventory back into stock.

## Real-Time Inventory Updates
Inventory quantities update immediately after reservation confirmation or release.

## Reservation Lifecycle Management
Supports:
- Reserve inventory
- Confirm purchase
- Release reservation
- Auto-expire reservation

## Professional Dashboard UI
Responsive dark-mode dashboard built with modern frontend tooling.

---

# Concurrency Protection

The core objective of this system is preventing race conditions during simultaneous checkout attempts.

## Tested Scenarios

- Two users reserving same inventory simultaneously
- Inventory exhaustion handling
- Reservation expiration recovery
- Multi-browser concurrent booking tests
- Warehouse-specific inventory conflicts

## Expected System Behavior

- Only one successful reservation per available inventory unit
- Failed concurrent attempts return conflict errors
- Inventory consistency maintained across sessions
- Zero-stock products cannot be reserved

---

# System Architecture

## Reservation Flow

```text
User Action
   ↓
Next.js API Route
   ↓
Reservation Service
   ↓
Prisma Transaction
   ↓
PostgreSQL Inventory Lock
   ↓
Atomic Inventory Update
   ↓
Reservation Created
