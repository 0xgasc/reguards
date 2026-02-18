# GuateRewards 🇬🇹

Hybrid Web2/Web3 rewards platform for Guatemala businesses. Combines email-based onboarding with blockchain-powered rewards and experiential NFTs.

## Features ✨

- **Email-based Auth**: No wallet needed - magic link authentication
- **Gasless Transactions**: Platform sponsors all blockchain interactions  
- **Experience NFTs**: Upload photos, create memories, earn bonus points
- **Multi-tier Rewards**: Bronze/Silver/Gold loyalty levels
- **Burnable Rewards**: NFTs can be burned for redemptions
- **Business Dashboard**: Easy management for business owners

## Architecture 🏗️

```
Frontend (React + Vite)
    ↓
Backend (Node.js + Express)
    ↓
Smart Contracts (Base L2)
```

## Quick Start 🚀

### Prerequisites

- Node.js 18+
- MongoDB
- Base Sepolia ETH (for deployment)

### 1. Install Dependencies

```bash
# Root project
npm install

# Backend
cd backend && npm install

# Frontend  
cd frontend && npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in:

```bash
# Blockchain
PRIVATE_KEY=your_private_key_here
SPONSOR_PRIVATE_KEY=sponsor_wallet_private_key
BASE_SEPOLIA_RPC=https://sepolia.base.org

# Backend
MONGODB_URI=mongodb://localhost:27017/guate-rewards
JWT_SECRET=your_jwt_secret
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=rewards@yourdomain.com

# Optional
IPFS_API_KEY=your_web3_storage_api_key
```

### 3. Deploy Smart Contracts

```bash
# Compile contracts
npm run compile

# Deploy to Base Sepolia
npm run deploy:base-testnet
```

Copy the factory address from deployment output to your `.env`:
```
FACTORY_ADDRESS=0x...
```

### 4. Start Services

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend  
npm run dev
```

Visit `http://localhost:3000` 🎉

## How It Works 🎯

### For Customers:
1. **Sign up** with just email (magic link)
2. **Earn points** with every purchase (1 point per Q1)
3. **Create experiences** by uploading photos (earn 2x bonus points)
4. **Redeem rewards** at participating businesses

### For Businesses:
1. **Create account** with business name
2. **Deploy reward program** (one-click Web3 setup)
3. **Register sales** to award points to customers
4. **Track analytics** through dashboard

### Experience Flow:
```
Purchase → Email Link → Upload Photo → Mint Experience NFT → Earn Bonus Points
```

## Smart Contract Architecture 📋

### GuateRewardsFactory.sol
- Deploys individual business reward programs
- Handles sponsored transactions (gasless for users)
- Manages platform fees and revenue splits

### BusinessRewards.sol (ERC1155)
- Token ID 0: Loyalty points (fungible)
- Token ID 1M+: Experience NFTs (non-fungible) 
- Supports burning for redemptions
- Dynamic metadata based on IPFS/Arweave

## API Endpoints 🔌

### Authentication
- `POST /api/auth/register` - Email signup/login
- `POST /api/auth/verify` - Magic link verification
- `GET /api/auth/profile` - User profile

### Sponsored Transactions  
- `POST /api/sponsor/record-purchase` - Award points for purchase
- `POST /api/sponsor/create-program` - Deploy business program
- `POST /api/sponsor/redeem` - Burn tokens for rewards

### Experiences
- `POST /api/experience/create` - Upload photo & mint NFT
- `GET /api/experience/my-experiences` - User's experiences

## Tech Stack 🛠️

**Frontend:**
- React 18 + Vite
- TailwindCSS
- React Query
- React Router

**Backend:** 
- Node.js + Express
- MongoDB + Mongoose
- JWT Auth
- Resend (email)
- Multer (file upload)

**Blockchain:**
- Solidity 0.8.20
- Hardhat
- OpenZeppelin
- Ethers.js v6
- Base L2 (cheap gas)

**Storage:**
- IPFS for NFT metadata
- Local/MongoDB for user data

## Cost Analysis 💰

### Monthly Operating Costs (1000 users):
- Email service: $5-10
- Base L2 gas (sponsored): $10-20  
- Backend hosting: $20
- Database: Free-$9
- **Total: ~$40-60/month**

### Per-transaction costs:
- Mint reward: ~$0.005
- Mint experience NFT: ~$0.005
- Burn for redemption: ~$0.005

## Development 👨‍💻

### Project Structure
```
guate-rewards/
├── contracts/           # Smart contracts
├── backend/            
│   ├── models/         # MongoDB models
│   ├── services/       # API routes
│   └── server.js
├── frontend/src/
│   ├── components/     # React components  
│   ├── contexts/       # Auth context
│   └── hooks/          # Custom hooks
├── scripts/            # Deployment scripts
└── deployments/        # Contract addresses
```

### Testing

```bash
# Smart contract tests
npm test

# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test
```

### Local Blockchain Development

```bash
# Start local Hardhat node
npx hardhat node

# Deploy to local network
npm run deploy:local
```

## Deployment 🌐

### Production Checklist

- [ ] Update environment variables
- [ ] Deploy contracts to Base mainnet
- [ ] Configure production database
- [ ] Set up proper email domain
- [ ] Enable IPFS pinning service
- [ ] Configure monitoring/analytics

### Staging Environment

Deploy to Base Sepolia for testing:
```bash
npm run deploy:base-testnet
```

## Business Model 💼

### Revenue Streams:
1. **Platform Fee**: 2.5% of reward program transactions
2. **Setup Fee**: Q300-600 per business onboarding  
3. **Premium Features**: Advanced analytics, custom branding

### Pricing Tiers:
- **Free**: Manual entry, basic analytics
- **Basic (Q100/month)**: Automated points, email notifications
- **Premium (Q250/month)**: POS integration, advanced features

## Roadmap 🗺️

### Phase 1 (MVP) ✅
- [x] Email authentication
- [x] Basic rewards system
- [x] Experience NFT creation
- [x] Business dashboard
- [x] Base testnet deployment

### Phase 2 (Scaling)
- [ ] WhatsApp notifications
- [ ] POS system integrations
- [ ] Mobile PWA
- [ ] Multi-language support

### Phase 3 (Advanced)
- [ ] Cross-business loyalty network
- [ ] DeFi integrations (staking, lending)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics & ML

## Contributing 🤝

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Security 🔒

- Smart contracts use OpenZeppelin standards
- Private keys encrypted at rest
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS and security headers configured

## License 📄

MIT License - see [LICENSE](LICENSE) file for details.

## Support 💬

- 📧 Email: hello@guaterewards.com
- 💬 Discord: [Join community](https://discord.gg/guaterewards)
- 📚 Docs: [docs.guaterewards.com](https://docs.guaterewards.com)

---

Made with ❤️ for Guatemala 🇬🇹