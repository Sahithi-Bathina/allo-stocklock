import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const warehouses = await db.warehouse.findMany();
    return NextResponse.json(warehouses, { status: 200 });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}