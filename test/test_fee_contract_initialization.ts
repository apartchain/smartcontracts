import { expect } from "chai";
import { ethers } from "hardhat";
import { ethers as eth } from "ethers";

describe("Fee contract initialization test", function () {
	let feeContract: eth.Contract;
	let feeFactory: eth.ContractFactory;
	let owner: eth.Signer, feeChanger: eth.Signer;

	before(async function () {
		[owner, feeChanger] = await ethers.getSigners();

		feeFactory = await ethers.getContractFactory("Fee");
		feeContract = await feeFactory.deploy(1000, 0, 500, 500);
		await feeContract.deployed();
	});

	it("should have a poa fee of 0", async function () {
		const fee = await feeContract.getPoaFee();
		expect(fee).to.eq(0);
	});

	it("should have booking fee of 0", async function () {
		const fee = await feeContract.getBookingFee(0);
		expect(fee).to.eq(0);
	});

	it("should set fee changer role to feeChanger signer", async function () {
		const address = await feeChanger.getAddress();

		const tx = feeContract.connect(owner).setFeeChanger(address);
		await expect(tx).to.be.not.reverted;

		const poaFee = eth.BigNumber.from(100000);
		const txSetPOAFee = feeContract.connect(feeChanger).setPoaFee(poaFee);
		await expect(txSetPOAFee).to.be.not.reverted;

		const getPoaFee = await feeContract.getPoaFee();
		expect(getPoaFee).to.equal(eth.BigNumber.from(poaFee));
	});
});
