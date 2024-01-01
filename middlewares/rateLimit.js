import { Cache } from 'memory-cache';

const cache = new Cache();
const NUMBER_OF_REQUESTS = 10;
const DURATION = 5000;

const rateLimit = req => {
  try {
    // get unique identifier
    const ip = req.headers.get('x-forwarded-for');
    const numReqs = cache.get(ip);
    if (numReqs == null) {
      cache.put(ip, 0, DURATION);
      return false;
    } else {
      if (numReqs > NUMBER_OF_REQUESTS) return true;
      cache.put(ip, numReqs + 1, DURATION);
      return false;
    }
  } catch (e) {
    console.log(e);
    return true;
  }
};

export default rateLimit;
