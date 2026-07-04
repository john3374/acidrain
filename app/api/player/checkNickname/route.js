import { Player } from '@/schema';
import rateLimit from '@/middlewares/rateLimit';
import { validateNickname } from '@/lib/nickname';
import { connectDB } from '@/db';

const POST = async req => {
  try {
    const limit = rateLimit(req);
    if (limit.limited) {
      return new Response('Too many requests', { status: 429, headers: limit.headers });
    }

    const { nickname } = await req.json();
    const parsed = validateNickname(nickname);
    if (!parsed.valid) {
      return Response.json({ error: parsed.error }, { status: 400, headers: limit.headers });
    }

    await connectDB();

    const exists = await Player.findOne({ nickname: parsed.value });
    return Response.json({ result: exists == null }, { headers: limit.headers });
  } catch (e) {
    console.log(e);
    return new Response('Unknown error', { status: 500 });
  }
};

export { POST };
