
import cronFetch from '../../src/Admin/Admin';

export default function handler(req, res) {
    // call only if we have a soft wallet
    cronFetch();
    
    res.status(200).end('Hello Decentralized Storage Cron!!!');
}