import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Force dynamic so it doesn't cache the stale inventory
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await db.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        price: true,
        inventories: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    return NextResponse.json(products, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}