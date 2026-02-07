import { NextRequest, NextResponse } from 'next/server';
import Location from '@/server/db/models/LocationModel';

// GET /api/locations/:id
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const location = await Location.findById(params.id);
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
  }
}

// DELETE /api/locations/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const location = await Location.findById(params.id);
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    await location.deleteOne();
    return NextResponse.json({ message: 'Location deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
  }
}