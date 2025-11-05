import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`);
    if (!response.ok) {
      throw new Error(`Deezer API responded with status: ${response.status}`);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching from Deezer API:', error);
    return NextResponse.json({ error: 'Failed to fetch data from Deezer API' }, { status: 500 });
  }
}
