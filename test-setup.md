# 🎉 GuateRewards Setup Complete!

Your platform is now fully deployed and running!

## 📊 Contract Info
- **Factory Address**: `0x9F2e8Ee423f11cCeDfe0f3bdb8E10Aa11Ac02AD7`
- **Network**: Base Sepolia
- **Deployer/Sponsor**: `0x23de198F1520ad386565fc98AEE6abb3Ae5052BE`
- **Balance**: ~0.092 ETH (sufficient for testing)

## 🌐 Running Services
- **Backend**: http://localhost:3001 ✅
- **Frontend**: http://localhost:5173 ✅ 
- **MongoDB**: Running ✅
- **Email**: Gmail configured ✅

## 🧪 Test Flow

### 1. Visit Frontend
Go to: http://localhost:5173

### 2. Create Customer Account
- Choose "Cliente" 
- Enter email: `test@example.com`
- Click "Acceder con Email"
- Check your inbox for magic link
- Click link to login

### 3. Create Business Account  
- Choose "Negocio"
- Enter business name: `Café Test`
- Enter email: `business@example.com` 
- Check inbox and login
- Click "Crear Programa de Recompensas"

### 4. Test Experience Flow
- As customer, visit: http://localhost:5173/experience/create?purchaseId=TEST123&points=10
- Upload a photo
- Add description
- Create experience NFT
- Earn bonus points

## 🔗 Quick Links
- **Login**: http://localhost:5173/login
- **Business Dashboard**: http://localhost:5173/business
- **Experience Creator**: http://localhost:5173/experience/create

## 📧 Email Templates
Your platform sends:
- Magic link authentication emails
- Experience creation confirmations
- Points earned notifications

## 🚀 Next Steps
1. **Test the full flow** with real email addresses
2. **Add real businesses** in Guatemala
3. **Integrate with POS systems**
4. **Deploy to production** (Vercel/Netlify + MongoDB Atlas)

## 💰 Costs (Per Month)
- **Email**: Free (Gmail)
- **Blockchain**: ~$10-20 (Base gas fees)
- **Hosting**: Free (dev) / ~$20 (prod)
- **Total**: Under $50/month

## 🛠️ Commands
```bash
# Start backend
cd backend && npm start

# Start frontend  
cd frontend && npx vite

# Deploy new contracts
npm run deploy:base-testnet

# View logs
pm2 logs # if using pm2
```

Your Web3 rewards platform is ready! 🇬🇹✨