import React from "react";
import { BN, web3 } from '@project-serum/anchor';
import { BigNumber } from 'bignumber.js'
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { PROGRAM_ID as HELIUM_VSR_PROGRAM_ID } from '@helium/voter-stake-registry-sdk'
import axios from "axios";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  getAllTokenOwnerRecords, 
  getTokenOwnerRecord, 
  getTokenOwnerRecordsByOwner,
  getGovernanceProgramVersion
  } from '@solana/spl-governance';
  import { 
    getRealmIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
} from '../../Governance/api/queries';

import { 
  PROXY,
  RPC_CONNECTION
} from './constants';

const SI_SYMBOL = ["", "k", "M", "G", "T", "P", "E"];

export const DEFAULT_NFT_VOTER_PLUGIN =
  'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw'
export const DEFAULT_NFT_VOTER_PLUGIN_V2 =
  'GnftVc21v2BRchsRa9dGdrVmJPLZiRHe9j2offnFTZFg'

export const VSR_PLUGIN_PKS: string[] = [
  '4Q6WW2ouZ6V3iaNm56MTd5n2tnTm4C5fiH8miFHnAFHo',
  'vsr2nfGVNHmSY8uxoBGqq8AQbwz3JwaEaHqGbsTPXqQ',
  'VotEn9AWwTFtJPJSMV5F9jsMY6QwWM5qn3XP9PATGW7',
  'VoteWPk9yyGmkX4U77nEWRJWpcc8kUfrPoghxENpstL',
  'VoteMBhDCqGLRgYpp9o7DGyq81KNmwjXQRAHStjtJsS',
  '5sWzuuYkeWLBdAv3ULrBfqA51zF7Y4rnVzereboNDCPn',
]

export const GOVERNANCE_STATE = {
  0:'Draft',
  1:'Signing Off',
  2:'Voting',
  3:'Succeeded',
  4:'Executing',
  5:'Completed',
  6:'Cancelled',
  7:'Defeated',
  8:'Executing w/errors!',
  9:'Vetoed',
}

export const HELIUM_VSR_PLUGINS_PKS: string[] = [
  HELIUM_VSR_PROGRAM_ID.toBase58(),
]

export const NFT_PLUGINS_PKS: string[] = [
  DEFAULT_NFT_VOTER_PLUGIN,
  'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw',
  'GnftVc21v2BRchsRa9dGdrVmJPLZiRHe9j2offnFTZFg', // v2, supporting compressed nft
]

export const GATEWAY_PLUGINS_PKS: string[] = [
  'Ggatr3wgDLySEwA2qEjt1oiw4BUzp5yMLJyz21919dq6',
  'GgathUhdrCWRHowoRKACjgWhYHfxCEdBi5ViqYN6HVxk', // v2, supporting composition
]

export const findPluginName = (programId: PublicKey | undefined) =>
  programId === undefined
    ? ('vanilla' as const)
    : VSR_PLUGIN_PKS.includes(programId.toString())
    ? ('VSR' as const)
    : HELIUM_VSR_PLUGINS_PKS.includes(programId.toString())
    ? 'HeliumVSR'
    : NFT_PLUGINS_PKS.includes(programId.toString())
    ? 'NFT'
    : GATEWAY_PLUGINS_PKS.includes(programId.toString())
    ? 'gateway'
    : 'unknown'

export function timeConvert(n: number, decimals = 0, abbr = false): string {
  const num = n;
  const hours = (num / 60);
  const rhours = Math.floor(hours);
  const minutes = (hours - rhours) * 60;
  const rminutes = Math.round(minutes);
  const rdays = Math.round(rhours / 24);
  let returnString = '';
  if (num === 1) {
      returnString = `${num} minute.`;
  } else if (num === 60) {
      returnString = '1 hour.';
  } else if (num > 60) {
      returnString = `${formatAmount(num, decimals, abbr)} minutes`;
      if (rdays > 1) {
          returnString += `. ~${rdays} days.`;
      } else {
          returnString = ` = ${formatAmount(rhours, decimals, abbr)} hour(s) and ${rminutes} minutes.`;
      }
  } else {
      returnString = `${rminutes} minutes.`;
  }
  return returnString;
}

export const shortenString = (input: any, startChars = 6, endChars = 6) => {
  if (input.length <= startChars + endChars) {
    return input;
  }

  const start = input.slice(0, startChars);
  const end = input.slice(-endChars);

  return `${start}...${end}`;
};

export async function getGrapeGovernanceProgramVersion(connection: Connection, programId: PublicKey, realmPk: PublicKey){
  return 3;
  /*
  if ((realmPk.toBase58() === "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip") ||
      (realmPk.toBase58() === "BVfB1PfxCdcKozoQQ5kvC9waUY527bZuwJVyT7Qvf8N2"))
  {
    return 3;
  } else{
    const programVersion = await getGovernanceProgramVersion(
      RPC_CONNECTION,
      programId,
    );
    return programVersion;
  }
    */
}

export const getFormattedNumberToLocale = (value: any, digits = 0) => {
  const converted = parseFloat(value.toString());
  const formatted = new Intl.NumberFormat('en-US', {
      minimumSignificantDigits: 1,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
  }).format(converted);
  return formatted || '';
}

export const formatThousands = (val: number, maxDecimals?: number, minDecimals = 0) => {
  let convertedVlue: Intl.NumberFormat;

  if (maxDecimals) {
      convertedVlue = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: minDecimals,
          maximumFractionDigits: maxDecimals
      });
  } else {
      convertedVlue = new Intl.NumberFormat("en-US", {
          minimumFractionDigits: minDecimals,
          maximumFractionDigits: 0
      });
  }

  return convertedVlue.format(val);
}

const abbreviateNumber = (number: number, precision: number) => {
  if (number === undefined) {
      return '--';
  }
  let tier = (Math.log10(number) / 3) | 0;
  let scaled = number;
  let suffix = SI_SYMBOL[tier];
  if (tier !== 0) {
      let scale = Math.pow(10, tier * 3);
      scaled = number / scale;
  }

  return scaled.toFixed(precision) + suffix;
};

export const formatAmount = (
  val: number,
  precision: number = 6,
  abbr: boolean = false
) => {
  if (val) {
      if (abbr) {
          return abbreviateNumber(val, precision);
      } else {
          return val.toFixed(precision);
      }
  }
  return '0';
};

export function getRemainingDays(targetDate?: string): number {
  const date = new Date();
  const time = new Date(date.getTime());
  const toDate = targetDate ? new Date(targetDate) : null;
  if (toDate) {
      time.setMonth(toDate.getMonth());
  } else {
      time.setMonth(date.getMonth() + 1);
  }
  time.setDate(0);
  return time.getDate() > date.getDate() ? time.getDate() - date.getDate() : 0;
}


export async function getTokenList(strict:boolean){
  let uri = `https://token.jup.ag/all`;
  if (strict)
    uri = `https://token.jup.ag/strict`;
  
  return axios.get(uri, {
          headers: {
          //    'x-api-key': SHYFT_KEY
          }
          })
      .then(response => {
          if (response?.data){
              const tokenList = response.data;
              //console.log("tokenList: "+JSON.stringify(tokenList))
              /*
              for (var item of tokenList){
                  // fix to push only what we have not already added
                  availableTokens.push({
                      mint:item.address,
                      name:item.name,
                      symbol:item.symbol,
                      decimals:item.decimals,
                      logo:item.logoURI
                  });
              }
              */
              return tokenList;
          }
          return null
      })
      .catch(error => 
          {   
              console.error(error);
              return null;
          });
}

export async function getJupiterPrices(tokens:string[], vsToken?:string, strict?:boolean) {
  
  // check first if strict token
  const tokenList = await getTokenList(strict);

  let finalTokenList = new Array();
  if (tokenList){
    for(let item of tokenList){
      for (let titem of tokens){
        if (titem === item.address){
          finalTokenList.push(titem);
        }
      }
    }
  } else{
    finalTokenList = tokens;
  }

  // Remove duplicates by converting to a Set and back to an array
  finalTokenList = [...new Set(finalTokenList)];
  
  let apiUrl = "https://lite-api.jup.ag/price/v2?ids=";
  //let apiUrl = "https://api.jup.ag/price/v2?ids=";
  //let apiUrl = "https://price.jup.ag/v4/price?ids=";
  
  let finalUrl = apiUrl + finalTokenList;
  if (vsToken)
    finalUrl = apiUrl + finalTokenList+"&vsToken="+vsToken;
  const resp = await window.fetch(finalUrl, {
  })
  const json = await resp.json(); 
  return json.data;
}

export async function getCoinGeckoPrices(tokens:string[]) {
  let tknString = '';
  let cnt = 0;
  for (var item of tokens){
    if (cnt > 0)
      tknString += ',';   
    tknString += item;
    cnt++;
  }
  const response = await fetch(PROXY+"https://api.coingecko.com/api/v3/simple/price?include_24hr_change=true&ids="+tknString+"&vs_currencies=usd",{
    method: "GET",
    //body: JSON.stringify(body),
    headers: { "Content-Type": "application/json",
                "Cache-Control": "s-maxage=8640" }
  }).catch((error)=>{
    console.log("ERROR GETTING CG DATA!");
    return null;
  });
  
  try{
    const json = await response.json();
    return json;
  }catch(e){return null;}
}
//Get Prices RPC
export async function getCoinGeckoPrice(token:string) {

  const response = await fetch(PROXY+"https://api.coingecko.com/api/v3/simple/price?include_24hr_change=true&ids="+token+"&vs_currencies=usd",{
    method: "GET",
    //body: JSON.stringify(body),
    headers: { "Content-Type": "application/json",
                "Cache-Control": "s-maxage=8640" }
  }).catch((error)=>{
    console.log("ERROR GETTING CG DATA!");
    return null;
  });
  
  try{
    const json = await response.json();
    return json;
  }catch(e){return null;}
}

export async function getTokenTicker(tokenIn:string,tokenOut:string) {
  const body = {
    id: tokenIn,
    vsToken: tokenOut
  }
  const apiUrl = "https://stats.jup.ag/coingecko/tickers?ticker_id="+tokenIn+"_"+tokenOut;
  const resp = await window.fetch(apiUrl, {
    //method:'GET',
    //body: JSON.stringify(body)
  })
  const json = await resp.json(); 
  return json
}

export async function getTokenPrice(tokenIn:string,tokenOut:string) {
  const body = {
    id: tokenIn,
    vsToken: tokenOut
  }
  const apiUrl = "https://price.jup.ag/v1/price?id="+tokenIn+"&vsToken="+tokenOut;
  const resp = await window.fetch(apiUrl, {
    //method:'GET',
    //body: JSON.stringify(body)
  })
  const json = await resp.json(); 
  return json
}

export async function getMintFromMetadataWithVerifiedCollection(updateAuthority:string, metadata:string) {
    
    // add a helper function to get Metadata from Grape Verified Collection

    // returns the mint address
}

export async function isGated(address: string, tokenWhitelist: string) {
  try{
    const tokenBalance = await RPC_CONNECTION.getParsedTokenAccountsByOwner(
        new PublicKey(address),
        {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        }
    )
    
    if (tokenBalance?.value){
        for (let item of tokenBalance?.value){
          if (item.account.data.parsed.info.mint === tokenWhitelist){
            if (item.account.data.parsed.info.tokenAmount.amount > 0)
              return true;
          }

        }
    }
    return false;
  }catch (e){
    console.log("ERR: "+e);
    return false;
  }
}

export async function findObjectByGoverningTokenOwner(memberMap: any, tokenOwner:string, viaRpc:boolean, minDepositedAmount?: number, realm?: any) {
  if ((!memberMap) && (realm)){
    // attempt to get via RPC
    //const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(realm.owner), new PublicKey(realm.pubkey))
    const rawTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(new PublicKey(realm.pubkey).toBase58(), realm.owner, tokenOwner)
    //const tokenOwnerRecord = await getTokenOwnerRecord(RPC_CONNECTION, )
    if (rawTokenOwnerRecords){
      //memberMap = JSON.parse(JSON.stringify(rawTokenOwnerRecords));
      const foundRawObject = await rawTokenOwnerRecords.find(item => (Number(item.account.governingTokenDepositAmount) > (minDepositedAmount || 0)) && new PublicKey(item.account.governingTokenOwner).toBase58() === tokenOwner);
      //console.log("foundRawObject: "+JSON.stringify(foundRawObject));
      if (foundRawObject)
        return foundRawObject || false; // Return null if not found
      else  
        return false;
    } else{
      console.log("ERR: "+e);
      return false;
    }
  } else {
    
    try{
        const foundObject = await memberMap.find(item => Number(item.account.governingTokenDepositAmount > (minDepositedAmount || 0)) && new PublicKey(item.account.governingTokenOwner).toBase58() === tokenOwner);
        if (foundObject)
          return foundObject || false; // Return null if not found
        else
          return false;
    }catch(e){
        console.log("ERR: "+e);
        return false;
    }
  }
}

export function convertSecondsToLegibleFormat(secondsStr:string, showOnlyUnit?: boolean, period?:number) {
  const seconds = +secondsStr;
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 31; // Approximate
  
  if (showOnlyUnit){
      if (seconds >= month) {
          return `Month`;
      } else if (seconds >= week) {
          return `Week`;
      } else if (seconds >= day) {
          return `Day`;
      } else if (seconds >= hour) {
          return `Hour`;
      } else if (seconds >= minute) {
          return `Minute`;
      } else {
          return `Second`;
      }
  }else{
      if (seconds >= month) {
          const months = period ? period : Math.floor(seconds / month);
          const remainingSeconds = seconds % month;
          const weeks = Math.floor(remainingSeconds / week);
          const days = Math.floor((remainingSeconds % week) / day);
          return `${months} months ${weeks > 0 ? ` ${weeks} days` : ``} ${days > 0 ? ` ${days} days` : ``}`;
      } else if (seconds >= week) {
          const weeks = Math.floor(seconds / week);
          const remainingSeconds = seconds % week;
          const days = Math.floor(remainingSeconds / day);
          return `${weeks} weeks ${days > 0 ? ` ${days} days` : ``}`;
      } else if (seconds >= day) {
          const days = Math.floor(seconds / day);
          const remainingSeconds = seconds % day;
          const hours = Math.floor(remainingSeconds / hour);
          return `${days} days ${hours > 0 ? ` ${hours} hours`:``}`;
      } else if (seconds >= hour) {
          const hours = Math.floor(seconds / hour);
          const remainingSeconds = seconds % hour;
          const minutes = Math.floor(remainingSeconds / minute);
          return `${hours} hours ${minutes > 0 ? ` ${minutes} minutes`:``}`;
      } else if (seconds >= minute) {
          const minutes = Math.floor(seconds / minute);
          const remainingSeconds = seconds % minute;
          return `${minutes} minutes ${remainingSeconds > 0 ? ` ${remainingSeconds} seconds`:``}`;
      } else {
          return `${seconds} seconds`;
      }
  }
}

export function parseMintNaturalAmountFromDecimal(
  decimalAmount: string | number,
  mintDecimals: number
) {
  if (typeof decimalAmount === 'number') {
    return getMintNaturalAmountFromDecimal(decimalAmount, mintDecimals)
  }

  if (mintDecimals === 0) {
    return parseInt(decimalAmount)
  }

  const floatAmount = parseFloat(decimalAmount)
  return getMintNaturalAmountFromDecimal(floatAmount, mintDecimals)
}

export function parseMintNaturalAmountFromDecimalAsBN(
  decimalAmount: string | number,
  mintDecimals: number
) {
  return new BN(
    parseMintNaturalAmountFromDecimal(decimalAmount, mintDecimals).toString()
  )
}

// Converts amount in decimals to mint amount (natural units)
export function getMintNaturalAmountFromDecimal(
  decimalAmount: number,
  decimals: number
) {
  return new BigNumber(decimalAmount).shiftedBy(decimals).toNumber()
}