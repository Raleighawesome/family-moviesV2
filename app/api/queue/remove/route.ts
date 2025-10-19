import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { itemId } = await req.json();

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the queue item (RLS will ensure they can only delete their own household's items)
    const { error: deleteError } = await supabase
      .from('list_items')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove from queue' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove from queue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
