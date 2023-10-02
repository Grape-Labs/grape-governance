import React from "react";
import { BN, web3 } from '@project-serum/anchor';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  getAllTokenOwnerRecords, 
  getTokenOwnerRecord, 
  getTokenOwnerRecordsByOwner  } from '@solana/spl-governance';
import { 
  PROXY,
  RPC_CONNECTION
} from './constants';

const SI_SYMBOL = ["", "k", "M", "G", "T", "P", "E"];

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

export async function getJupiterPrices(tokens:string[], vsToken?:string) {
  const body = {
    ids: tokens,
  }
  let apiUrl = "https://price.jup.ag/v4/price?ids="+tokens;
  if (vsToken)
    apiUrl = "https://price.jup.ag/v4/price?ids="+tokens+"&vsToken="+vsToken;
  const resp = await window.fetch(apiUrl, {
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
    const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(realm.owner), new PublicKey(realm.pubkey))
    //const tokenOwnerRecord = await getTokenOwnerRecord(RPC_CONNECTION, )
    if (rawTokenOwnerRecords){
      //memberMap = JSON.parse(JSON.stringify(rawTokenOwnerRecords));
      const foundRawObject = await rawTokenOwnerRecords.find(item => (Number(item.account.governingTokenDepositAmount) > (minDepositedAmount || 0)) && item.account.governingTokenOwner?.toBase58() === tokenOwner);
      console.log("foundRawObject: "+JSON.stringify(foundRawObject));
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
        const foundObject = await memberMap.find(item => Number(item.account.governingTokenDepositAmount > (minDepositedAmount || 0)) && item.account.governingTokenOwner?.toBase58() === tokenOwner);
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