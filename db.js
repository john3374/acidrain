import mongoose from 'mongoose';
const username = encodeURIComponent('acidrain');
const tlsCertificateKeyFile = 'X509-cert-5587615441697623497.pem';
mongoose.set('strictQuery', true);
mongoose.connect(`mongodb+srv://${username}@cluster0.wi516.mongodb.net/acidrain`, {
  tls: true,
  tlsCertificateKeyFile,
  authMechanism: 'MONGODB-X509',
  autoIndex: true,
});
export default mongoose;
