const Web3 = require("web3");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const txnsData = require("./participant_tx_list.json");
const fs = require('fs');

async function election() {
  const web3 = new Web3();
  const seed = "0x36bede69b9d69ee7e5a73dfcf75ebed69ea131ea0395f6842690a2965ee2e233";
  
  // 1. Filter transactions with specific input value
  const filteredTxns = txnsData.filter(tx => 
    tx.input === "0x096a37780000000000000000000000000000000000000000000000000000000000000000"
  );

  // 2. Calculate tickets for each participant
  const tickets = filteredTxns.map(tx => {
    const ticket = web3.utils.soliditySha3(
      { t: 'address', v: tx.from },
      { t: 'bytes32', v: seed }
    );
    return {
      address: tx.from,
      ticket: ticket
    };
  });

  // 3. Sort tickets in ascending order using BigNumber comparison
  const sortedTickets = tickets.sort((a, b) => {
    const aBN = web3.utils.toBN(a.ticket);
    const bBN = web3.utils.toBN(b.ticket);
    return aBN.cmp(bBN);
  });

  // Get top 3 winners
  const winners = sortedTickets.slice(0, 3);

  console.log("Lucky Draw Winners:");
  winners.forEach((winner, index) => {
    console.log(`${index + 1}. Address: ${winner.address}`);
    console.log(`   Ticket: ${winner.ticket}`);
  });

  // 4. Generate Merkle Tree
  // Create leaves from sorted tickets
  const leaves = sortedTickets.map(ticket => {
    // Combine address and ticket into a single hash
    return keccak256(ticket.address + ticket.ticket.slice(2)); // slice(2) removes '0x' prefix
  });

  // Create Merkle Tree
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot().toString('hex');

  // Create proofs for all participants using sorted tickets
  const allProofs = sortedTickets.map(ticket => {
    const leaf = keccak256(ticket.address + ticket.ticket.slice(2));
    const proof = tree.getProof(leaf);
    return {
      user: ticket.address.toLowerCase(),
      ticket: ticket.ticket,
      proof: proof.map(x => '0x' + x.data.toString('hex'))
    };
  });

  // Create the final result object
  const result = {
    rewardDistributionChain: "Arbitrum One",
    seed: seed,
    root: `0x${root}`,
    proofs: allProofs
  };

  // Write to proofs.json
  fs.writeFileSync('proofs.json', JSON.stringify(result, null, 2));

  console.log(`Total participants in Merkle Tree: ${allProofs.length}`);
  return result;
}

// Execute the draw
election().catch(console.error);
