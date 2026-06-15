import React, { useEffect, useState } from 'react'

import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale'
interface OrderData {
  timeZone: string;
  slaTime: number;
  currentDayOrderCount: number;
  openOrderCount: number;
  pickPackOrderCount: number;
  completedOrderCount: number;
  openOrderDetails: { orderId: string; orderDate: string }[];
  readyForPickupOrderDetails: { orderId: string; orderDate: string }[];
}
const TileComponent = () => {
  const api = useApi();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [badge, setBadge] = useState(0);
  const [sddData,setSddData] = useState<OrderData | null>(null);
  const [bopisData,setBopisData] = useState<OrderData | null>(null);
  const [bopisInstoreData,setBopisInstoreData] = useState<OrderData | null>(null);
  const [deliveryBadge, setDeliveryBadge] = useState(0);
  const [bopisBadge, setBopisBadge] = useState(0);
  const [subtitle, setSubtitle] = useState('');
  const [title, setTitle ] = useState('');
  const { currentSession, getSessionToken } = useApi().session;
  const { shopDomain, locationId } = currentSession;
  const [error, setError] = useState(null);
  let host = "";
  if (shopDomain.includes('dev') || shopDomain.includes('test') || shopDomain.includes('it-aloyoga')) {
    host = "https://alo.pos.shopifyapps.dev.alo.software";
  } else {
    host = "https://alo.pos.shopifyapps.alo.software";
  }


  const fetchSddData = async () => {
    try {
      const token = await api.session.getSessionToken();
      const url = `${host}/pos/v1/store/getOrderDetails?locationId=${locationId}&fulfillmentType=DELIVERY`;
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setSddData(result.payload); // Update orderData with the payload from the API
      } else {
        console.error('Error fetching data:', result.error);
        setError(result.error);
      }
    } catch (error) {
      console.log('Network error:', error);
      setError('Unauthorized: Invalid session');
    }
  };

   useEffect(() => {
      fetchSddData(); // Initial fetch
      const interval = setInterval(fetchSddData, 300000); // Fetch every 5 minutes (300000ms)
      return () => clearInterval(interval); // Cleanup interval on component unmount
    }, []);

  const fetchStoreSTSData = async () => {
      try {
       const token = await api.session.getSessionToken();
       const url = `${host}/pos/v1/store/getOrderDetails?locationId=${locationId}&fulfillmentType=PICKUP&isTransferOrder=true`;
  
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });
        const result = await response.json();
        
        console.log('result', result);
        if (result.success) {
          setBopisInstoreData(result.payload); 
        } else {
          console.error('Error fetching data:', result.error);
          setError(result.error);
        }
      } catch (error) {
        console.log('Network error:', error);
        setError('Unauthorized: Invalid session');
      }
    };

    const fetchInStorePickupData = async () => {
      try {
       const token = await api.session.getSessionToken();
       const url = `${host}/pos/v1/store/getOrderDetails?locationId=${locationId}&fulfillmentType=PICKUP`;
  
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });
        const result = await response.json();
        console.log('result', result);
        if (result.success) {
          setBopisData(result.payload);
        } else {
          console.error('Error fetching data:', result.error);
          setError(result.error);
        }
      } catch (error) {
        console.log('Network error:', error);
        setError('Unauthorized: Invalid session');
      }
    };
    
    useEffect(() => {
      fetchInStorePickupData(); // Initial fetch
      const interval = setInterval(fetchInStorePickupData, 300000); // Fetch every 5 minutes (300000ms)
      return () => clearInterval(interval); // Cleanup interval on component unmount
    }, []);
    useEffect(() => {
      fetchStoreSTSData(); // Initial fetch
      const interval = setInterval(fetchStoreSTSData, 300000); // Fetch every 5 minutes (300000ms)
      return () => clearInterval(interval); // Cleanup interval on component unmount
    }, []);
  
      // Delivery badge
  useEffect(() => {
    if (sddData) {
      if (sddData.openOrderCount > 0) {
        setDeliveryBadge(sddData.openOrderCount);
      }else{
        setDeliveryBadge(0);
      }
    } else {
      setDeliveryBadge(0);
    }
  }, [sddData]);
  
  // BOPIS badge
  useEffect(() => {
    if (bopisData && bopisInstoreData) {
      if (bopisData.openOrderCount > 0 || bopisInstoreData.openOrderCount > 0) {
        setBopisBadge(bopisData.openOrderCount + bopisInstoreData.openOrderCount);
      }else{
        setBopisBadge(0);
      }
    } else {
      setBopisBadge(0);
    }
  }, [bopisData,bopisInstoreData]);

  useEffect(() => {
    if(sddBadge > 0 || bopisBadge > 0) {
        setBadge(sddBadge + bopisBadge); 
    }
  }, [sddData, bopisData,sddBadge, bopisBadge]);

// Conditionally build the subtitle based on whether the delivery or BOPIS tile is enabled
useEffect(() => {
    setTitle('OMNIs');
    setSubtitle(
      (deliveryBadge > 0 ? `${deliveryBadge} Delivery Orders | ` : 'No Delivery Orders\n') +
      (bopisBadge > 0 ? `${bopisBadge} BOPIS Orders` : 'No BOPIS Orders')
    );
}, [bopisBadge, sddBadge]);


  return (
    <Tile
  title={title}
  subtitle={subtitle}
  onPress={() => {
    api.action.presentModal();
  }}
  destructive={badge > 0}
  badgeValue={badge}
  enabled={true}
/>
  )
}

export default reactExtension('pos.home.tile.render', () => {
  return <TileComponent />
})
