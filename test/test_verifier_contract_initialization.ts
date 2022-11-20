import { expect } from "chai";
import { ethers } from "hardhat";
import { ethers as eth } from 'ethers';

describe("Verifier contract initialization test", function () {
	let verifierContract: eth.Contract;
	let verifierFactory: eth.ContractFactory;
	let owner: eth.Signer, verifier: eth.Signer, user: eth.Signer;

	beforeEach(async function () {
		[owner, verifier, user] = await ethers.getSigners();

		verifierFactory = await ethers.getContractFactory("Verifier");
		verifierContract = await verifierFactory.deploy();
		await verifierContract.deployed();
	});


	it("should return that sender is not agency", async function () {
		const address = await owner.getAddress();
		const isAgency = await verifierContract.isVerifiedAgency(address);
		expect(isAgency).to.eq(false);
	});

	it("should return that sender is not verified user", async function () {
		const address = await owner.getAddress();
		const isVerifiedUser = await verifierContract.isVerifiedUser(address);
		expect(isVerifiedUser).to.eq(false);
	});

	it("should set role to verifier ", async function () {
		const address = await verifier.getAddress();
		const tx = await verifierContract.connect(owner).setVerifier(address, true);
		expect(tx.hash).to.not.be.undefined;
	});

	it("should set and unset role to verifier ", async function () {
		const address = await verifier.getAddress();
		const tx = await verifierContract.connect(owner).setVerifier(address, true);
		expect(tx.hash).to.not.be.undefined;

		const tx2 = await verifierContract.connect(owner).setVerifier(address, false);
		expect(tx2.hash).to.not.be.undefined;

		// expect to revert
		const txSetUser = verifierContract.connect(verifier).setVerificationUser(address, true);

		await expect(txSetUser).to.be.reverted;
	});

	it("should set user verified", async function () {
		const addressVerifier = await verifier.getAddress();
		const txSetVerifier = await verifierContract.connect(owner).setVerifier(addressVerifier, true);
		expect(txSetVerifier.hash).to.not.be.undefined;
		const addressUser = await user.getAddress();

		let isVerifiedUser = await verifierContract.isVerifiedUser(addressUser);
		expect(isVerifiedUser).to.eq(false);

		const txSetUser = await verifierContract.connect(verifier).setVerificationUser(addressUser, true);
		expect(txSetUser.hash).to.not.be.undefined;


		isVerifiedUser = await verifierContract.isVerifiedUser(addressUser);
		expect(isVerifiedUser).to.eq(true);
	});

	it("should set user verified agency", async function () {
		const addressVerifier = await verifier.getAddress();
		const txSetVerifier = await verifierContract.connect(owner).setVerifier(addressVerifier, true);
		expect(txSetVerifier.hash).to.not.be.undefined;
		const addressUser = await user.getAddress();

		let isVerifiedUser = await verifierContract.isVerifiedAgency(addressUser);
		expect(isVerifiedUser).to.eq(false);

		const txSetUser = await verifierContract.connect(verifier).setVerificationAgency(addressUser, true);
		expect(txSetUser.hash).to.not.be.undefined;


		isVerifiedUser = await verifierContract.isVerifiedAgency(addressUser);
		expect(isVerifiedUser).to.eq(true);
	});
});
