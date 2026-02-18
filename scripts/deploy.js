const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Deploying GuateRewards to", hre.network.name);
    
    // Get signers
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    
    // Get balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");
    
    // Deploy Factory
    console.log("\n📦 Deploying GuateRewardsFactory...");
    const Factory = await hre.ethers.getContractFactory("GuateRewardsFactory");
    
    // Use deployer as initial sponsor wallet (can be changed later)
    const factory = await Factory.deploy(deployer.address);
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    console.log("✅ GuateRewardsFactory deployed to:", factoryAddress);
    
    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        factoryAddress: factoryAddress,
        deployer: deployer.address,
        sponsorWallet: deployer.address,
        blockNumber: await deployer.provider.getBlockNumber(),
        timestamp: new Date().toISOString(),
        contractAbis: {
            factory: "GuateRewardsFactory",
            businessRewards: "BusinessRewards"
        }
    };
    
    // Write to file
    const deploymentFile = path.join(__dirname, '..', 'deployments', `${hre.network.name}.json`);
    fs.mkdirSync(path.dirname(deploymentFile), { recursive: true });
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("📄 Deployment info saved to:", deploymentFile);
    
    // Verify on Etherscan if not local network
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\n⏳ Waiting for block confirmations...");
        await factory.deploymentTransaction().wait(6);
        
        try {
            console.log("🔍 Verifying contract on BaseScan...");
            await hre.run("verify:verify", {
                address: factoryAddress,
                constructorArguments: [deployer.address]
            });
            console.log("✅ Contract verified!");
        } catch (error) {
            console.log("❌ Verification failed:", error.message);
        }
    }
    
    // Test basic functionality
    console.log("\n🧪 Testing basic functionality...");
    try {
        const platformFee = await factory.platformFeePercentage();
        console.log("💰 Platform fee:", platformFee.toString(), "basis points");
        
        const sponsorWallet = await factory.sponsorWallet();
        console.log("👤 Sponsor wallet:", sponsorWallet);
        
        console.log("✅ Basic functionality tests passed!");
    } catch (error) {
        console.log("❌ Basic tests failed:", error.message);
    }
    
    // Setup instructions
    console.log("\n📋 Next steps:");
    console.log("1. Copy the factory address to your .env file:");
    console.log(`   FACTORY_ADDRESS=${factoryAddress}`);
    console.log("2. Fund the sponsor wallet with ETH for gasless transactions");
    console.log("3. Start the backend server with updated contract address");
    console.log("4. Test creating a business program through the frontend");
    
    return {
        factory: factoryAddress,
        deployer: deployer.address
    };
}

main()
    .then((addresses) => {
        console.log("\n🎉 Deployment completed successfully!");
        console.log("Factory:", addresses.factory);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });