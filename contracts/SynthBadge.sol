// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";


contract SynthBadge is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    constant apiUrl = "https://synthetixbadges.netlify.com/";               // api.synthetix.io
    constant tokenUrl = "https://synthetixspartan.netlify.com/badges/";     // synthetix.io/badges

    // Chainlink
    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    // Internals
    mapping (bytes32=> address) public requestByAddress;
    mapping (address=> string[]) public badgesByUser;
    mapping (address=> uint256) public totalUserBadges;

    // Events
    event RoundFought(address indexed player, Fighter hero, Fighter opponent, bool result);

    /**
     * An epic battle to the death for a last man standing to win an NFT of their fighter and some SNX.
     */
    constructor() payable
    ERC721("SynthBadge", "sNFT")
    {
        // KOVAN settings
        setPublicChainlinkToken();
        oracle = 0x2f90A6D021db21e1B2A077c5a37B3C7E75D15b7e;
        jobId = "29fa9aa13bf1468788b7cc4a500a45b8";
        fee = 0.1 * 10 ** 18; // (Varies by network and job)
    }

    /**
     * Create a Chainlink request to retrieve API response, find the target
     * data, then multiply by 1000000000000000000 (to remove decimal places from data).
     */
    function requestBadges() public returns (bytes32 requestId)
    {
        Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);

        // Set the URL to perform the GET request on
        request.add("get", abi.encodePacked(apiUrl, msg.sender));

        // Sends the request
        bytes32 _requestId = sendChainlinkRequestTo(oracle, request, fee);
    }

    /**
     * Receive the response in the form of uint256
     */
    function fulfill(bytes32 _requestId, string[] memory _badges) public recordChainlinkFulfillment(_requestId)
    {
        address badgeUser = requestByAddress[_requestId];
        if(_badges.length > 0) {
            bool badgeFound;
            uint256 i;
            uint256 j;
            badgeFound = false;
            for(i=0; i<_badges.length; i++) {
                // Check that they don't already have it
                for(j=0; j<totalUserBadges[badgeUser]; j++) {
                    if(_badges[i] == badgesByUser[badgeUser][j]) {
                        badgeFound = true;
                    }
                }
                if(!badgeFound) {
                    mintNFT(badgeUser, abi.encodePack(_badges[i], '.json'));
                }
                badgeFound = false;
            }
        }
    }

    /**
     * Mint the NFT.
     */
    function mintNFT(address owner, string memory tokenURI) public {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _safeMint(owner, tokenId);
        _setTokenURI(tokenId, abi.encodePacked(tokenUrl, tokenURI))
    }

    /**
     * Get my tokens helper function for front-end usability.
     * Concept borrowed from CryptoKitties.
     */
    function getMyTokens() view public returns(uint256[] memory) {
        uint256 tokenCount = balanceOf(msg.sender);
        if (tokenCount == 0) {
            return new uint256[](0);
        } else {
            uint256[] memory result = new uint256[](tokenCount);
            uint256 totalTokens = _tokenIds.current();
            uint256 resultIndex = 0;
            for (uint256 t = 1; t <= totalTokens; t++) {
                if (_exists(t) && ownerOf(t) == msg.sender) {
                    result[resultIndex] = t;
                    resultIndex++;
                }
            }
            return result;
        }
    }
}



