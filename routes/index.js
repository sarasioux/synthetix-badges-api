const express = require('express');
const fetch = require('node-fetch');
const await = require('asyncawait');
const Web3 = require('web3');
const TruffleContract = require("@truffle/contract");

// Constants
const siteUrl = 'https://synthetixbadges.netlify.app/';
const provider = 'wss://kovan.infura.io/ws/v3/8f868fcca6aa44febce5b6a085aa23f2';
const contractAddress = '0x22025e2b843A22cC567863C270D24da29aC7B326';               // Address of the token contract
const ownerAccount = '0x00796e910Bd0228ddF4cd79e3f353871a61C351C';                  // Address of the contract owner

const allBadges = {
    1: siteUrl + 'badges/90_days.json',
    2: siteUrl + 'badges/180_days.json',
    3: siteUrl + 'badges/365_days.json',
    4: siteUrl + 'badges/top_100.json',
    5: siteUrl + 'badges/top_1000.json',
}

// Start the router
const router = express.Router();

// Start web3
const web3 = new Web3(Web3.givenProvider || new Web3.providers.WebsocketProvider(provider));
let contract;
let badges = {};

/* GET home page. */
router.get('/', function(req, res, next) {
    res.json({msg:'Synthetix Badges API'});
});

/* GET all claimable badges. */
router.get('/badges/:address', function(req, res, next) {
    const address = req.params.address;
    
    initContract().then(() => {
        getBadges(address, badges, (badges) => {
            filterQualifyingBadges(address, badges, (badges) => {
                let returnBadges = [];
                for (let i = 0; i < badges.length; i++) {
                    returnBadges.push(allBadges[badges[i]]);
                }
                res.json(returnBadges);
            });
        });
    });
    
});

/* GET one claimable badge. */
router.get('/badge/:address', async function(req, res, next) {
    const address = req.params.address;
    
    initContract().then(() => {
        getBadges(address, badges, (badges) => {
            getNextBadge(address, badges).then((response) => {
                res.json(response);
            });
        });
    });
    
});

// Initialize the contract to check on our existing badge status
const initContract = async function() {
    const response = await fetch(siteUrl + 'contracts/SynthBadge.json');
    const json = await response.json();
    contract = TruffleContract(json);
    contract.setProvider(web3.currentProvider);
    contract.defaults({
        from: ownerAccount,
        gasPrice: 1000000000
    });
}

// Returns array of qualifying badges
const filterQualifyingBadges = async function(address, badges, callback) {
    try {
        let deployed = await contract.deployed();
        let myBadges = await deployed.getUserBadges.call(address, {from: ownerAccount});
        let qualifyingBadges = [];
        for(let i=0; i<badges.length; i++) {
            if(!myBadges.find((elem) => elem === badges[i])) {
                qualifyingBadges.push(badges[i]);
            }
        }
        callback(qualifyingBadges);
    } catch(err){
        console.error(err)
    }
};

// Returns one qualifying badge
const getNextBadge = async function(address, badges) {
    try {
        let deployed = await contract.deployed();
        let myBadges = await deployed.getUserBadges.call(address, {from: ownerAccount});
        for(let i=0; i<badges.length; i++) {
            if(!myBadges.find((elem) => elem === badges[i])) {
                return {id:parseInt(badges[i])};
            }
        }
        return {id:0};
    } catch(err){
        console.error(err)
    }
};

// Gets all badges that might qualify
const getBadges = async function(address, badges, callback) {
    staking(address, badges, (badges) => {
        whale(address, badges, (badges) => {
            let returnBadges = []
            for(let i in badges) {
                returnBadges.push(i);
            }
            callback(returnBadges);
        });
    });
}

// Check on their staking history
const staking = async function(address, badges, callback) {
    const debtHistoryQuery = {
        query: `{debtSnapshots(where:{ account_in: ["${address}"] },orderBy: block,orderDirection: desc){timestamp}}`,
        variables: null,
    };
    graphQuery(debtHistoryQuery, (response, err) => {
        if(response && response.debtSnapshots) {
            const month = 60 * 60 * 24 * 30 * 1000;
            for(let i=0; i<response.debtSnapshots.length; i++) {
                if(response.debtSnapshots[i].timestamp*1000 < (Date.now() - month*3) ) {
                    badges[1] = true;
                }
                if(response.debtSnapshots[i].timestamp*1000 < (Date.now() - month*6) ) {
                    badges[2] = true;
                }
                if(response.debtSnapshots[i].timestamp*1000 < (Date.now() - month*12) ) {
                    badges[3] = true;
                }
            }
        }
        callback(badges);
    });
}

// Check on their whale status
const whale = async function(address, badges, callback) {
    const whaleStatusQuery = {
        query: `{snxholders(orderBy: balanceOf, orderDirection: desc, first: 1000) {id balanceOf }}`,
        variables: null,
    };
    graphQuery(whaleStatusQuery, (response) => {
        if(response && response.snxholders) {
            for(let i=0; i<response.snxholders.length; i++) {
                if(response.snxholders[i].id === address) {
                    if(i<100) {
                        badges[4] = true;
                    }
                    badges[5] = true;
                }
            }
        }
        callback(badges);
    });
}

// Query The Graph -- Only queries mainnet but rewards on whatever network you're connected to
const graphQuery = async function(query, callback) {
    const body = JSON.stringify(query);
    fetch('https://api.thegraph.com/subgraphs/name/synthetixio-team/synthetix', {
        method: 'POST',
        body: body
    })
      .then(res => res.json())
      .then(json => callback(json.data));
}

module.exports = router;
