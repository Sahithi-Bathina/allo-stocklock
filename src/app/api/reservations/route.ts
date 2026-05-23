import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/services/reservationService';
import { z } from 'zod';

const reserveSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = reserveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input fields', details: validation.error.format() }, { status: 400 });
    }

    const { productId, warehouseId, quantity } = validation.data;
    
    const result = await ReservationService.reserveProduct(productId, warehouseId, quantity);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json(result.reservation, { status: 201 });
  } catch (error) {
    console.error('Error in reserve API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}