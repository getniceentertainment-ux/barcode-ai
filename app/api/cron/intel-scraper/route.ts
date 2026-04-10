import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Adjust based on your actual supabase client path

// The exact keywords indicating competitor frustration
const TARGET_QUERIES = [
  '"bandlab lag"',
  '"bandlab latency"',
  '"rapchat delay"',
  '"bluetooth mic lag"',
  '"bandlab deleting my tracks"'
];

export async function GET(req: Request) {
  // Security: Ensure this is only triggered by Vercel Cron or an authorized admin
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const queryStr = TARGET_QUERIES.join(' OR ');
    // Hit the X API v2 (Recent Search)
    const xResponse = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(queryStr)}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username`, {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      }
    });

    if (!xResponse.ok) {
      throw new Error(`X API Error: ${xResponse.statusText}`);
    }

    const data = await xResponse.json();

    if (data.meta.result_count === 0) {
      return NextResponse.json({ message: 'No new intel found.', count: 0 });
    }

    // Map the users array for easy username lookup
    const usersMap = new Map();
    if (data.includes && data.includes.users) {
      data.includes.users.forEach((u: any) => usersMap.set(u.id, u.username));
    }

    const intercepts = data.data.map((tweet: any) => {
      const username = usersMap.get(tweet.author_id) || 'unknown';
      return {
        target_user: username,
        content: tweet.text,
        tweet_url: `https://x.com/${username}/status/${tweet.id}`,
        keyword_triggered: 'competitor_lag', // You can parse the text to find the exact match later
        status: 'pending'
      };
    });

    // Inject into the Matrix
    const { error } = await supabase
      .from('intel_intercepts')
      .upsert(intercepts, { onConflict: 'tweet_url' }); // Prevent duplicates

    if (error) throw error;

    return NextResponse.json({ 
      message: 'Intel successfully intercepted.', 
      count: intercepts.length 
    });

  } catch (error: any) {
    console.error("Intel Scraper Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}