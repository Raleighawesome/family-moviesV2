import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const valid = username === 'movies' && password === 'dadmode';
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });

    // Set beta auth cookie for 7 days
    res.cookies.set('beta_auth', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
  }
}

