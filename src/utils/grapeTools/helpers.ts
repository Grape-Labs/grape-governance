import React from "react";
import { BN, web3 } from '@project-serum/anchor';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  GRAPE_RPC_ENDPOINT,
  PROXY,
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