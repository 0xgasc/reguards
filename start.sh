#!/bin/bash

echo "🚀 Starting GuateRewards Platform..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "📦 Starting MongoDB..."
    brew services start mongodb-community
fi

# Start backend
echo "🔧 Starting backend server..."
cd /Users/g/reguards/guate-rewards/backend
node server.js &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd /Users/g/reguards/guate-rewards/frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ Platform started!"
echo "📍 Backend: http://localhost:3001"
echo "📍 Frontend: http://localhost:5173"
echo "📍 Health: http://localhost:3001/health"
echo ""
echo "📧 Email configured: GASOLOMONC@GMAIL.COM"
echo "🏦 Contract: 0x9F2e8Ee423f11cCeDfe0f3bdb8E10Aa11Ac02AD7"
echo "⛽ Wallet: 0x23de198F1520ad386565fc98AEE6abb3Ae5052BE"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" INT
wait