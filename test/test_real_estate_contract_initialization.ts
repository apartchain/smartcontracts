import { expect } from "chai";
import { ethers } from "hardhat";
import { ethers as eth } from 'ethers';

describe("RealEstate contract with initialization", function () {
	let realEstateContract: eth.Contract;
	let realEstateFactory: eth.ContractFactory;
	let owner: eth.Signer, marketplace: eth.Signer, tokenHolder: eth.Signer;


	beforeEach(async function () {
		[owner, marketplace, tokenHolder] = await ethers.getSigners();

		realEstateFactory = await ethers.getContractFactory("RealEstate");
		realEstateContract = await realEstateFactory.deploy();
		await realEstateContract.deployed();
	});


	it("should set marketplace role to marketplace eth.Signer", async function () {
		const marketplaceAddress = await marketplace.getAddress();
		const tx = realEstateContract.connect(owner).setMarketplaceContract(marketplaceAddress);

		await expect(tx).not.to.be.reverted;
	});

	it("should create one token to tokenHolder account and return id 1", async function () {
		const marketplaceAddress = await marketplace.getAddress();
		await realEstateContract.connect(owner).setMarketplaceContract(marketplaceAddress);

		const receiverAddress = await tokenHolder.getAddress();
		await realEstateContract.connect(marketplace).createToken(receiverAddress);

		const tokenBalance = await realEstateContract.balanceOf(receiverAddress, 1);
		expect(tokenBalance).to.equal(1);
	});


	it("should create and transfer one token to owner account", async function () {
		const marketplaceAddress = await marketplace.getAddress();
		await realEstateContract.connect(owner).setMarketplaceContract(marketplaceAddress);

		const receiverAddress = await tokenHolder.getAddress();
		await realEstateContract.connect(marketplace).createToken(receiverAddress);

		const tokenBalance = await realEstateContract.balanceOf(receiverAddress, 1);
		expect(tokenBalance).to.equal(1);

		const ownerAddress = await owner.getAddress();
		await realEstateContract.connect(marketplace).safeTransferFrom(receiverAddress, ownerAddress, 1, 1, "0x");

		const ownerTokenBalance = await realEstateContract.balanceOf(ownerAddress, 1);
		expect(ownerTokenBalance).to.equal(1);


		const newTokenBalance = await realEstateContract.balanceOf(receiverAddress, 1);
		expect(newTokenBalance).to.equal(0);
	});

	it("should burn token", async function () {
		const marketplaceAddress = await marketplace.getAddress();
		await realEstateContract.connect(owner).setMarketplaceContract(marketplaceAddress);

		const receiverAddress = await tokenHolder.getAddress();
		await realEstateContract.connect(marketplace).createToken(receiverAddress);

		const tokenBalance = await realEstateContract.balanceOf(receiverAddress, 1);
		expect(tokenBalance).to.equal(1);

		await realEstateContract.connect(marketplace).burn(receiverAddress, 1, 1);

		const newTokenBalance = await realEstateContract.balanceOf(receiverAddress, 1);
		expect(newTokenBalance).to.equal(0);
	});
})