

export default function handler(req, res) {

    // call only if we have a soft wallet

    res.status(200).end('Hello Decentralized Storage Cron!!!');
}