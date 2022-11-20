import { expect } from "chai";
import { ethers } from "hardhat";
import { ethers as eth } from "ethers";


function getPlatformFee(price: eth.BigNumber): eth.BigNumber {
	if (price.eq(0)) {
		return eth.BigNumber.from(0);
	}

	let factor = eth.BigNumber.from(1);

	for (let i = 0; i < 18 && price.gt(factor.mul(10)); i++) {
		factor = factor.mul(10);
	}

	return (
		(
			price
				.div(factor)
		)
			.add(1)
	)
		.mul(factor);
}

describe("Fee contract with values", function () {
	let feeContract: eth.Contract;
	let feeFactory: eth.ContractFactory;
	let owner: eth.Signer, feeChanger: eth.Signer;

	const BOOKING_FEE_PERCENTAGE = eth.BigNumber.from(1000);

	const ONE_DOLLAR = eth.BigNumber.from(1_000_000);
	const HUNDRED_PERCENT = eth.BigNumber.from(10_000);

	const POA_FEE = eth.BigNumber.from(2_000).mul(ONE_DOLLAR);
	const PRICE = eth.BigNumber.from(500_000).mul(ONE_DOLLAR);

	const BUYER_FEE_NUMERATOR = eth.BigNumber.from(200);
	const SELLER_FEE_NUMERATOR = eth.BigNumber.from(200);

	beforeEach(async function () {
		[owner, feeChanger] = await ethers.getSigners();

		feeFactory = await ethers.getContractFactory("Fee");

		feeContract = await feeFactory.deploy(
			BOOKING_FEE_PERCENTAGE, POA_FEE, BUYER_FEE_NUMERATOR, SELLER_FEE_NUMERATOR
		);

		await feeContract.deployed();

		// Getting address of fee changer
		const address = await feeChanger.getAddress();
		// Connecting to smart contract and setting role for the fee changer
		await feeContract.connect(owner).setFeeChanger(address);
	});

	it(`should have a booking fee of ${PRICE} * ${BOOKING_FEE_PERCENTAGE}/${HUNDRED_PERCENT}`, async function () {
		const fee = await feeContract.getBookingFee(PRICE);
		expect(fee).to.eq(PRICE.mul(BOOKING_FEE_PERCENTAGE).div(HUNDRED_PERCENT));
	});

	it(`should have a poa fee of ${POA_FEE}`, async function () {
		const fee = await feeContract.getPoaFee();
		expect(fee).to.eq(POA_FEE);
	});

	it(`should have buyer fee of 2% approximately of price ${PRICE}`, async function () {
		const fee = await feeContract.getBuyerFee(PRICE);

		const buyerFee = getPlatformFee(PRICE)
			.mul(BUYER_FEE_NUMERATOR)
			.div(HUNDRED_PERCENT)

		// console.log(`Buyer fee: ${buyerFee.toString()}/${PRICE.toString()}`);

		expect(fee).to.eq(buyerFee);
	});

	it(`should have seller fee of 2% approximately of price ${PRICE}`, async function () {
		const fee = await feeContract.getSellerFee(PRICE);

		const sellerFee = getPlatformFee(PRICE)
			.mul(SELLER_FEE_NUMERATOR)
			.div(HUNDRED_PERCENT)

		// console.log(`Seller fee: ${sellerFee.toString()}/${PRICE.toString()}`);

		expect(fee).to.eq(sellerFee);
	});

	it("should have booking fee of 0 if input is zero", async function () {
		const fee = await feeContract.getBookingFee(0);
		expect(fee).to.eq(0);
	});
});
