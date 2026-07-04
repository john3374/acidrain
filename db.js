import mongoose from 'mongoose';

const DEFAULT_DB_NAME = 'acidrain';
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 5000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

const getRequiredEnv = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const buildMongoUri = () => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const host = getRequiredEnv('DB_HOST');
  const dbName = process.env.MONGODB_DB || process.env.DB_NAME || DEFAULT_DB_NAME;

  if (host.startsWith('mongodb://') || host.startsWith('mongodb+srv://')) return host;

  const username = encodeURIComponent(getRequiredEnv('DB_USER'));
  const password = encodeURIComponent(getRequiredEnv('DB_PASSWORD'));
  const protocol = host === 'localhost' || host.startsWith('localhost:') || host.includes(':') ? 'mongodb' : 'mongodb+srv';

  return `${protocol}://${username}:${password}@${host}/${dbName}`;
};

const getPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getConnectionOptions = () => {
  const certificateKeyFile = process.env.MONGODB_X509_CERTIFICATE_KEY_FILE;
  const options = {
    autoIndex: process.env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: getPositiveInteger(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, DEFAULT_SERVER_SELECTION_TIMEOUT_MS),
    connectTimeoutMS: getPositiveInteger(process.env.MONGODB_CONNECT_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS),
  };

  if (certificateKeyFile) {
    options.tls = true;
    options.tlsCertificateKeyFile = certificateKeyFile;
    options.authMechanism = 'MONGODB-X509';
  }

  return options;
};

mongoose.set('strictQuery', true);

const globalForMongoose = globalThis;

if (!globalForMongoose.mongooseConnection) {
  globalForMongoose.mongooseConnection = { conn: null, promise: null };
}

export const connectDB = async () => {
  if (globalForMongoose.mongooseConnection.conn) return globalForMongoose.mongooseConnection.conn;

  if (!globalForMongoose.mongooseConnection.promise) {
    globalForMongoose.mongooseConnection.promise = mongoose.connect(buildMongoUri(), getConnectionOptions());
  }

  try {
    globalForMongoose.mongooseConnection.conn = await globalForMongoose.mongooseConnection.promise;
    return globalForMongoose.mongooseConnection.conn;
  } catch (error) {
    globalForMongoose.mongooseConnection.promise = null;
    error.message = `MongoDB connection failed: ${error.message}`;
    throw error;
  }
};

export default mongoose;
