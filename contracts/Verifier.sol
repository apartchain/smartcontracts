// Contract Name: Verifier
// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract Verifier is Context, AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER");

    mapping(address => bool) private agencies;
    mapping(address => bool) private users;

    event AgencyVerified(address user, bool verified);
    event UserVerified(address user, bool verified);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setVerifier(address _verifier, bool _set) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_set) {
            _setupRole(VERIFIER_ROLE, _verifier);
        } else {
            _revokeRole(VERIFIER_ROLE, _verifier);
        }
    }

    function isVerifiedAgency(address _agency) public view returns (bool) {
        return agencies[_agency];
    }

    function isVerifiedUser(address _user) public view returns (bool) {
        return users[_user];
    }

    function setVerificationAgency(address _agency, bool _set) public onlyRole(VERIFIER_ROLE) {
        require(agencies[_agency] != _set, "already setted");
        agencies[_agency] = _set;
        emit AgencyVerified(_agency, _set);
    }

    function setVerificationUser(address _user, bool _set) public onlyRole(VERIFIER_ROLE) {
        require(users[_user] != _set, "already setted");
        users[_user] = _set;
        emit UserVerified(_user, _set);
    }
}