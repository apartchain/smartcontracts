import { expect } from "chai";
import { ethers } from "hardhat";
import { ethers as eth } from "ethers";

describe("Marketplace contract initialization test", function () {
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
		agency: eth.Signer,
		buyer: eth.Signer;

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
		[owner, marketplace, tokenHolder, multiSigner, agency, buyer] =
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

		await referralContract.connect(owner).setService(multiAddress, true);

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
		const buyerAddress = await buyer.getAddress();
		const marketplaceAddress = await marketplace.getAddress();

		// Setting up the mock usdc contract
		usdcFactory = await ethers.getContractFactory("MockUsdc");
		usdcContract = await usdcFactory.deploy(
			marketplaceAddress,
			buyerAddress
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

		await marketplaceContract
			.connect(owner)
			.setMarketplace(marketplaceAddress, true);


		const agencyAddress = await agency.getAddress();

		await verifierContract
			.connect(multiSigner)
			.setVerificationAgency(agencyAddress, true);
		await verifierContract
			.connect(multiSigner)
			.setVerificationUser(buyerAddress, true);
	});


	it("should create token by agency", async function () {
		const agencyAddress = await agency.getAddress();
		const tokenHolderAddress = await tokenHolder.getAddress();

		await marketplaceContract
			.connect(agency)
			.createProperty("", tokenHolderAddress, PRICE);

		const balanceMarketplace = await realEstateContract.balanceOf(
			marketplaceContract.address,
			1
		);
		expect(balanceMarketplace).to.be.eq(1);

		const balanceAgency = await realEstateContract.balanceOf(agencyAddress, 1);

		expect(balanceAgency).to.be.eq(0);
	});

	it("should create token by agency and be booked by buyer user", async function () {
		const tokenHolderAddress = await tokenHolder.getAddress();

		await marketplaceContract
			.connect(agency)
			.createProperty("", tokenHolderAddress, PRICE);

		const bookingFee = await feeContract.getBookingFee(PRICE);
		usdcContract
			.connect(buyer)
			.increaseAllowance(marketplaceContract.address, bookingFee);

		const tx = marketplaceContract.connect(buyer).bookProperty(1, false);
		await expect(tx).not.to.be.reverted;
	});

	it("should create token by agency and be booked by buyer, bought", async function () {
		const tokenHolderAddress = await tokenHolder.getAddress();
		const buyerAddress = await buyer.getAddress();

		const initialBalanceMarketplaceContract = await usdcContract.balanceOf(
			marketplaceContract.address
		);
		const initialBalanceBuyer = await usdcContract.balanceOf(
			buyerAddress
		);


		// create property
		await marketplaceContract
			.connect(agency)
			.createProperty("", tokenHolderAddress, PRICE);


		// book property
		const bookingFee = await feeContract.getBookingFee(PRICE);

		await usdcContract
			.connect(buyer)
			.increaseAllowance(marketplaceContract.address, bookingFee);

		await marketplaceContract.connect(buyer).bookProperty(1, false);

		// after booking stage

		// signing docs stage
		await marketplaceContract.connect(marketplace).signedAllDoc(1, true);


		// buying stage
		const buyerFee = await feeContract.getBuyerFee(PRICE);
		const finalPrice = PRICE.sub(bookingFee).add(buyerFee);

		await usdcContract
			.connect(buyer)
			.increaseAllowance(marketplaceContract.address, finalPrice);
		const tx = marketplaceContract.connect(buyer).buyProperty(1);

		await expect(tx).not.to.be.reverted;

		// balance after buying check

		const finalBalanceMarketplaceContract = await usdcContract.balanceOf(
			marketplaceContract.address
		);

		const finalBalanceBuyer = await usdcContract.balanceOf(buyerAddress);

		expect(
			finalBalanceMarketplaceContract.sub(initialBalanceMarketplaceContract)
		).to.equal(initialBalanceBuyer.sub(finalBalanceBuyer));
	});



	it("should create token by agency and be booked by buyer bought and fulfilled", async function () {
		const agencyAddress = await agency.getAddress();
		const tokenHolderAddress = await tokenHolder.getAddress();

		const buyerAddress = await buyer.getAddress();
		const ownerAddress = await owner.getAddress();

		await marketplaceContract
			.connect(agency)
			.createProperty("", tokenHolderAddress, PRICE);

		const initialBalanceMarketplaceContract = await usdcContract.balanceOf(
			marketplaceContract.address
		);
		const initialBalanceAgency = await usdcContract.balanceOf(
			agencyAddress
		);
		const initialBalanceBuyer = await usdcContract.balanceOf(
			buyerAddress
		);
		const initialBalanceTokenHolder = await usdcContract.balanceOf(
			tokenHolderAddress
		);
		const initialBalanceOwner = await usdcContract.balanceOf(
			ownerAddress
		);

		// booking stage
		const bookingFee = await feeContract.getBookingFee(PRICE);

		await usdcContract
			.connect(buyer)
			.increaseAllowance(marketplaceContract.address, bookingFee);

		await marketplaceContract.connect(buyer).bookProperty(1, false);


		// signing docs stage
		await marketplaceContract.connect(marketplace).signedAllDoc(1, true);

		// buying stage

		const buyerFee = await feeContract.getBuyerFee(PRICE);

		const finalPrice = PRICE.sub(bookingFee).add(buyerFee);


		await usdcContract
			.connect(buyer)
			.increaseAllowance(marketplaceContract.address, finalPrice);

		await marketplaceContract.connect(buyer).buyProperty(1);

		// fulfillment stage

		const tx = marketplaceContract.connect(marketplace).fulfillBuy(1);

		await expect(tx).not.to.be.reverted;


		// balance check

		const finalBalanceAgency = await usdcContract.balanceOf(agencyAddress);
		const finalBalanceTokenHolder = await usdcContract.balanceOf(tokenHolderAddress);
		const finalBalanceMarketplaceContract = await usdcContract.balanceOf(
			marketplaceContract.address
		);
		const finalBalanceBuyer = await usdcContract.balanceOf(buyerAddress);
		const finalBalanceOwner = await usdcContract.balanceOf(ownerAddress);

		const sellerFee = await feeContract.getSellerFee(PRICE);
		const platformFee = buyerFee.add(sellerFee);
		const agencyFee = PRICE.mul(2).div(100);



		expect(
			finalBalanceMarketplaceContract
		).to.equal(0);

		expect(
			initialBalanceBuyer.sub(finalBalanceBuyer)
		).to.equal(PRICE.add(buyerFee));


		expect(
			finalBalanceTokenHolder.sub(initialBalanceTokenHolder)
		).to.equal(PRICE.sub(sellerFee).sub(agencyFee));


		expect(
			finalBalanceAgency.sub(initialBalanceAgency)
		).to.equal(agencyFee);
	});
});
