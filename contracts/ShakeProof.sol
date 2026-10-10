// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title ShakeProof
/// @notice Records a real-world meetup only when BOTH people signed the same EIP-712
///         handshake. Anyone (e.g. a gas-paying relayer) can submit it; the signatures
///         are the consent. Each pair of wallets can only be recorded once, so meets
///         cannot be farmed by repeating the same two accounts.
contract ShakeProof is EIP712 {
    struct Handshake {
        bytes32 sessionId; // unique id of the meetup session
        address a;         // session creator
        address b;         // session joiner
        bytes32 questId;   // icebreaker quest both completed
        uint64 deadline;   // unix seconds after which the signatures are void
    }

    bytes32 public constant HANDSHAKE_TYPEHASH = keccak256(
        "Handshake(bytes32 sessionId,address a,address b,bytes32 questId,uint64 deadline)"
    );

    mapping(bytes32 => bool) public sessionUsed;
    mapping(bytes32 => bool) public pairMet;
    mapping(address => uint256) public meetCount;

    event MeetRecorded(bytes32 indexed sessionId, address indexed a, address indexed b, bytes32 questId);

    error SameWallet();
    error Expired();
    error SessionAlreadyUsed();
    error PairAlreadyMet();
    error BadSignature(address expected);

    constructor() EIP712("ShakeProof", "1") {}

    function recordMeet(Handshake calldata h, bytes calldata sigA, bytes calldata sigB) external {
        if (h.a == h.b) revert SameWallet();
        if (block.timestamp > h.deadline) revert Expired();
        if (sessionUsed[h.sessionId]) revert SessionAlreadyUsed();

        bytes32 key = pairKey(h.a, h.b);
        if (pairMet[key]) revert PairAlreadyMet();

        bytes32 digest = hashHandshake(h);
        if (ECDSA.recover(digest, sigA) != h.a) revert BadSignature(h.a);
        if (ECDSA.recover(digest, sigB) != h.b) revert BadSignature(h.b);

        sessionUsed[h.sessionId] = true;
        pairMet[key] = true;
        unchecked {
            meetCount[h.a] += 1;
            meetCount[h.b] += 1;
        }

        emit MeetRecorded(h.sessionId, h.a, h.b, h.questId);
    }

    function hashHandshake(Handshake calldata h) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(HANDSHAKE_TYPEHASH, h.sessionId, h.a, h.b, h.questId, h.deadline))
        );
    }

    function pairKey(address x, address y) public pure returns (bytes32) {
        return x < y ? keccak256(abi.encodePacked(x, y)) : keccak256(abi.encodePacked(y, x));
    }

    function haveMet(address x, address y) external view returns (bool) {
        return pairMet[pairKey(x, y)];
    }
}
