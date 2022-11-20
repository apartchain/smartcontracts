import { expect } from "chai";
import { ethers } from "hardhat";
import { ethers as eth } from 'ethers';

describe("Referral contract initialization test", function () {
	let referralContract: eth.Contract;
	let referralFactory: eth.ContractFactory;
	let owner: eth.Signer, referralService: eth.Signer, referral: eth.Signer;

	beforeEach(async function () {
		[owner, referralService, referral] = await ethers.getSigners();

		referralFactory = await ethers.getContractFactory("Referral");
		referralContract = await referralFactory.deploy();
		await referralContract.deployed();
	});


	it("should get referrer with address(0)", async function () {
		const address = await owner.getAddress();
		const referrer = await referralContract.getReferrer(address);
		const zeroAddress = ethers.constants.AddressZero;
		expect(referrer).to.equal(zeroAddress);
	});

	it("should grant role to referralService", async function () {
		const address = await referralService.getAddress();
		const role = referralContract.connect(owner).setService(address, true);
		await expect(role).not.to.be.reverted;
	});

	it("should set referral for referral eth.Signer", async function () {
		const referralAddress = await referral.getAddress();
		const referrerAddress = await owner.getAddress();

		const serviceAddress = await referralService.getAddress();
		await referralContract.connect(owner).setService(serviceAddress, true);


		await referralContract.connect(referralService).setReferral(referralAddress, referrerAddress);

		const referrerAddressSC = await referralContract.getReferrer(referralAddress);
		expect(referrerAddressSC).to.equal(referrerAddress);
	});
});
