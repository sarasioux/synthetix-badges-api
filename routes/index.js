const express = require('express');
const router = express.Router();

const fetch = require('node-fetch');

/* GET home page. */
router.get('/', function(req, res, next) {
    res.send('Synthetix Badges API');
});

/* GET home page. */
router.get('/:address', function(req, res, next) {
    
    const address = req.params.address;
    let badges = {};
    
    staking(address, badges, (badges) => {
        whale(address, badges, (badges) => {
            console.log('badges', badges);
            let returnBadges = []
            for(let i in badges) {
                returnBadges.push(i);
            }
            res.json(returnBadges);
        });
    });
    
});

// Check on their staking history
async function staking(address, badges, callback) {
    const debtHistoryQuery = {
        query: `{debtSnapshots(where:{ account_in: ["${address}"] },orderBy: block,orderDirection: desc){timestamp}}`,
        variables: null,
    };
    graphQuery(debtHistoryQuery, (response, err) => {
        if(response && response.debtSnapshots) {
            const month = 60 * 60 * 24 * 30 * 1000;
            for(let i=0; i<response.debtSnapshots.length; i++) {
                if(response.debtSnapshots[i].timestamp*1000 < (Date.now() - month*3) ) {
                    badges['90_days'] = true;
                }
                if(response.debtSnapshots[i].timestamp*1000 < (Date.now() - month*6) ) {
                    badges['180_days'] = true;
                }
                if(response.debtSnapshots[i].timestamp*1000 < (Date.now() - month*12) ) {
                    badges['365_days'] = true;
                }
            }
        }
        callback(badges);
    });
}

// Check on their whale status
async function whale(address, badges, callback) {
    const whaleStatusQuery = {
        query: `{snxholders(orderBy: balanceOf, orderDirection: desc, first: 1000) {id balanceOf }}`,
        variables: null,
    };
    graphQuery(whaleStatusQuery, (response) => {
        if(response && response.snxholders) {
            for(let i=0; i<response.snxholders.length; i++) {
                if(response.snxholders[i].id === address) {
                    if(i<100) {
                        badges['top_100'] = true;
                    }
                    badges['top_1000'] = true;
                }
            }
        }
        callback(badges);
    });
}

async function graphQuery(query, callback) {
    const body = JSON.stringify(query);
    fetch('https://api.thegraph.com/subgraphs/name/synthetixio-team/synthetix', {
        method: 'POST',
        body: body
    })
      .then(res => res.json())
      .then(json => callback(json.data));
}

module.exports = router;
