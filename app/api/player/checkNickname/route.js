import rateLimit from '@/middlewares/rateLimit';
import { Player } from '@/schema';
import '@/db';

const POST = async req => {
  try {
    if (rateLimit(req)) {
      return new Response('Too many requests', {
        status: 429,
        // headers: {
        //   'X-RateLimit-Limit': limit.toString(),
        //   'X-RateLimit-Remaining': 0,
        //   'X-RateLimit-Reset': reset.toString(),
        // },
      });
    }

    const { nickname } = await req.json();
    const exists = await Player.findOne({ nickname });
    return Response.json({ result: exists == null });
  } catch (e) {
    console.log(e);
    return new Response('Unknown error', { status: 500 });
  }
};

export { POST };
