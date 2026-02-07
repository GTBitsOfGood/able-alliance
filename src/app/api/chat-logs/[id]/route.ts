import { NextRequest, NextResponse } from 'next/server';
import { getChatlogById } from '@/server/db/actions/ChatlogAction';

// GET /api/chat-logs/:id
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const chatlog = await getChatlogById(params.id);
    if (!chatlog) {
      return NextResponse.json({ error: 'Chatlog not found' }, { status: 404 });
    }
    return NextResponse.json(chatlog);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chatlog' }, { status: 500 });
  }
}