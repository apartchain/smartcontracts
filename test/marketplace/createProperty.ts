import { expect } from "chai";
import { ethers } from "hardhat";
import { ethers as eth } from "ethers";

describe("Create property", function () {
	let usdcContract: eth.Contract;
	let usdcFactory: eth.ContractFactory;

	let feeContract: eth.Contract;
	let feeFactory: eth.ContractFactory;

	let referralContract: eth.Contract;
	let referralFactory: eth.ContractFactory;

	let verifierContract: eth.Contract;
	let verifierFactory: eth.ContractFactory;

	let realEstateContract: eth.Contract;
	let realEstateFactory: eth.ContractFactory;

	let owner: eth.Signer,
		marketplace: eth.Signer,
		tokenHolder: eth.Signer,
		multiSigner: eth.Signer,
		agency: eth.Signer;

	let marketplaceContract: eth.Contract;
	let marketplaceFactory: eth.ContractFactory;

	const BOOKING_FEE_PERCENTAGE = eth.BigNumber.from(1000);

	const ONE_DOLLAR = eth.BigNumber.from(1_000_000);
	const HUNDRED_PERCENT = eth.BigNumber.from(10_000);

	const POA_FEE = eth.BigNumber.from(2_000).mul(ONE_DOLLAR);
	const PRICE = eth.BigNumber.from(500_000).mul(ONE_DOLLAR);

	const BUYER_FEE_NUMERATOR = eth.BigNumber.from(200);
	const SELLER_FEE_NUMERATOR = eth.BigNumber.from(200);


	// _platform,  _realEstate,  _verifier,  _fee,  _referral,  _usdcAddress,  _priceFeed) {
	beforeEach(async function () {
		[owner, marketplace, tokenHolder, multiSigner, agency] =
			await ethers.getSigners();

		const multiAddress = await multiSigner.getAddress();
		// Setting up the verifier contract
		verifierFactory = await ethers.getContractFactory("Verifier");
		verifierContract = await verifierFactory.deploy();
		await verifierContract.deployed();

		await verifierContract.connect(owner).setVerifier(multiAddress, true);

		// Setting up the referral contract
		referralFactory = await ethers.getContractFactory("Referral");
		referralContract = await referralFactory.deploy();
		await referralContract.deployed();

		// Setting up the fee contract
		feeFactory = await ethers.getContractFactory("Fee");
		feeContract = await feeFactory.deploy(
			BOOKING_FEE_PERCENTAGE, POA_FEE, BUYER_FEE_NUMERATOR, SELLER_FEE_NUMERATOR
		);
		await feeContract.deployed();

		await feeContract.connect(owner).setFeeChanger(multiAddress);

		// Setting up the real estate contract
		realEstateFactory = await ethers.getContractFactory("RealEstate");
		realEstateContract = await realEstateFactory.deploy();
		await realEstateContract.deployed();

		const ownerAddress = await owner.getAddress();
		const tokenHolderAddress = await tokenHolder.getAddress();
		const marketplaceAddress = await marketplace.getAddress();

		// Setting up the mock usdc contract
		usdcFactory = await ethers.getContractFactory("MockUsdc");
		usdcContract = await usdcFactory.deploy(
			marketplaceAddress,
			tokenHolderAddress
		);
		await usdcContract.deployed();

		// Setting up the marketplace contract
		marketplaceFactory = await ethers.getContractFactory("Marketplace");
		marketplaceContract = await marketplaceFactory.deploy(
			ownerAddress,
			realEstateContract.address,
			verifierContract.address,
			feeContract.address,
			referralContract.address,
			usdcContract.address,
			ethers.constants.AddressZero
		);
		await marketplaceContract.deployed();

		await realEstateContract
			.connect(owner)
			.setMarketplaceContract(marketplaceContract.address);

	});

	it("Create Property by the verified agency", async function () {
		const tokenHolderAddress = await tokenHolder.getAddress();

		const agencyAddress = await agency.getAddress();
		await verifierContract
			.connect(multiSigner)
			.setVerificationAgency(agencyAddress, true);

		const tx = marketplaceContract
			.connect(agency)
			.createProperty("", tokenHolderAddress, ONE_DOLLAR);
		
		await expect(tx).not.to.be.reverted;

		const balance = await realEstateContract.balanceOf(
			marketplaceContract.address,
			1
		);
		expect(balance).to.be.eq(1);
	});

	it("Create Property by the not verified agency", async function () {
		const tokenHolderAddress = await tokenHolder.getAddress();

		const tx = marketplaceContract
			.connect(tokenHolder)
			.createProperty("", tokenHolderAddress, ONE_DOLLAR);
		await expect(tx).to.be.reverted;
	});
});
