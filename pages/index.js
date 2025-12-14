import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamic import to avoid SSR issues with window/localStorage/Audio
const MainGame = dynamic(() => import('../components/MainGame'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Chronobingo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <MainGame />
    </>
  );
}