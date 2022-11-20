// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile');


	const BOOKING_FEE_PERCENTAGE = ethers.BigNumber.from(1000);

	const ONE_DOLLAR = ethers.BigNumber.from(1_000_000);

	const POA_FEE = ethers.BigNumber.from(2_000).mul(ONE_DOLLAR);


	const BUYER_FEE_NUMERATOR = ethers.BigNumber.from(200);
	const SELLER_FEE_NUMERATOR = ethers.BigNumber.from(200);

	// We get the contract to deploy
	const Fee = await ethers.getContractFactory("Fee");
	const fee = await Fee.deploy(
		BOOKING_FEE_PERCENTAGE, POA_FEE, BUYER_FEE_NUMERATOR, SELLER_FEE_NUMERATOR
	);

	await fee.deployed();

	console.log("Fee deployed to:", fee.address);


	const RealEstate = await ethers.getContractFactory("RealEstate");
	const realEstate = await RealEstate.deploy();

	await realEstate.deployed();

	console.log("RealEstate deployed to:", realEstate.address);

	const Verifier = await ethers.getContractFactory("Verifier");
	const verifier = await Verifier.deploy();

	await verifier.deployed();

	console.log("Verifier deployed to:", verifier.address);

	const Referral = await ethers.getContractFactory("Referral");
	const referral = await Referral.deploy();

	await referral.deployed();

	console.log("Referral deployed to:", referral.address);

	const Marketplace = await ethers.getContractFactory("Marketplace");
	const marketplace = await Marketplace.deploy(
		`${process.env.platform_address}`,
		realEstate.address,
		verifier.address,
		fee.address,
		referral.address,
		`${process.env.usdc_address}`,
		`${process.env.forwarder_address}`
	);

	await marketplace.deployed();

	console.log("Marketplace deployed to:", marketplace.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
