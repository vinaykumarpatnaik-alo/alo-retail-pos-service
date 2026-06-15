import React, { useEffect, useState } from 'react';

import {
  Text,
  Screen,
  ScrollView,
  Navigator,
  reactExtension,
  Stack,
  Section,
  Selectable,
  useApi,
  Banner,
  SegmentedControl
} from '@shopify/ui-extensions-react/point-of-sale';
import { OrderCountCard } from './OrderCountCard';

interface OrderData {
  timeZone: string;
  slaTime: number;
  currentDayOrderCount: number;
  openOrderCount: number;
  pickPackOrderCount: number;
  completedOrderCount: number;
  inTransitOrderCount: number;
  openOrderDetails: { orderId: string; orderDate: string }[];
  readyForPickupOrderDetails: { orderId: string; orderDate: string }[];
  sddTileEnable?: boolean;
  bopisTileEnable?: boolean;
  regularHours?: Record<string, { openAt: string; closeAt: string }>;
}

const Modal = () => {
  const { device } = useApi();
  console.log('device', device)
  const api = useApi<'pos.home.modal.render'>();
  const { currentSession, getSessionToken } =
    useApi<'pos.home.modal.render'>().session;
  console.log('currentSession', currentSession)
  console.log('getSessionToken', getSessionToken)
  const { shopDomain, locationId } = currentSession;
  let host = "";
  if (shopDomain.includes('dev') || shopDomain.includes('test') || shopDomain.includes('it-aloyoga')) {
    host = "https://alo.pos.shopifyapps.dev.alo.software";
  } else {
    host = "https://alo.pos.shopifyapps.alo.software";
  }
  const [selected, setSelected] = useState('openOrders');
  const [isTablet, setIsTablet] = useState(true);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [sddData, setSddData] = useState<OrderData | null>(null);
  const [bopisPickupData, setBopisPickupData] = useState<OrderData | null>(null);
  const [bopisDeliveryData, setBopisDeliveryData] = useState<OrderData | null>(null);
  const [deliveryBadge, setDeliveryBadge] = useState(0);
  const [bopisBadge, setBopisBadge] = useState(0);
  const [bopisDeliveryBadge, setBopisDeliveryBadge] = useState(0);
  const [bopisPickupBadge, setBopisPickupBadge] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stsTileEnable, setSTSTileEnable] = useState(false)

  useEffect(() => {
    async function checkTablet() {
      const istab = await device.isTablet();
      setIsTablet(istab);
    }
    checkTablet();
  }, []);

  useEffect(() => {
    if (orderData) {
      setLoading(false);
    }
  }, [orderData])


  // Delivery badge
  useEffect(() => {
    if (sddData) {
      if (sddData.openOrderCount > 0) {
        setDeliveryBadge(sddData.openOrderCount);
      } else {
        setDeliveryBadge(0);
      }
    } else {
      setDeliveryBadge(0);
    }
  }, [orderData, sddData]);


  useEffect(() => {
    setBopisBadge(bopisPickupBadge + bopisDeliveryBadge);
  }, [bopisPickupBadge, bopisDeliveryBadge]);
 

  // BOPIS badge
  useEffect(() => {
    if (bopisPickupData) {
      if (bopisPickupData.openOrderCount > 0) {
        setBopisPickupBadge(bopisPickupData.openOrderCount);
      } else {
        setBopisPickupBadge(0);
      }
    } else {
      setBopisPickupBadge(0);
    }
  }, [orderData, bopisPickupData]);

  useEffect(() => {
    if (bopisDeliveryData) {
      if (bopisDeliveryData.openOrderCount > 0) {
        setBopisDeliveryBadge(bopisDeliveryData.openOrderCount);
      } else {
        setBopisDeliveryBadge(0);
      }
    } else {
      setBopisDeliveryBadge(0);
    }
  }, [orderData, bopisDeliveryData]);

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
        setOrderData(result.payload); // Update orderData with the payload from the API
        setSddData(result.payload); // Update orderData with the payload from the API
        setLoading(false);
        console.log(result.payload);
      } else {
        console.error('Error fetching data:', result.error);
        setError(result.error);
        setLoading(false);
      }
    } catch (error) {
      console.log('Network error:', error);
      setError('Unauthorized: Invalid session');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSddData(); // Initial fetch
    const interval = setInterval(fetchSddData, 300000); // Fetch every 5 minutes (300000ms)
    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  const fetchBopisPickupData = async () => {
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
      if (result.success) {
        setOrderData(result.payload); // Update orderData with the payload from the API
        setBopisPickupData(result.payload);
        setSTSTileEnable(result.payload.stsTileEnable);
        //api.toast.show(`BOPIS Pickup Orders: ${JSON.stringify(result.payload.stsTileEnable)}`, { duration: 30000000 });
        setLoading(false);
        console.log(result.payload);
      } else {
        console.error('Error fetching data:', result.error);
        setError(result.error);
        setLoading(false);
      }
    } catch (error) {
      console.log('Network error:', error);
      setError('Unauthorized: Invalid session');
      setLoading(false);
    }
  };

  
  const fetchBopisDeliveryData = async () => {
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
      if (result.success) {
        setOrderData(result.payload); // Update orderData with the payload from the API
        setBopisDeliveryData(result.payload);
        setLoading(false);
        console.log(result.payload);
      } else {
        console.error('Error fetching data:', result.error);
        setError(result.error);
        setLoading(false);
      }
    } catch (error) {
      console.log('Network error:', error);
      setError('Unauthorized: Invalid session');
      setLoading(false);
    }
  };

  

  useEffect(() => {
    fetchBopisPickupData(); // Initial fetch
    const interval = setInterval(fetchBopisPickupData, 300000); // Fetch every 5 minutes (300000ms)
    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  useEffect(() => {
    if(stsTileEnable){
      fetchBopisDeliveryData(); // Initial fetch
      const interval = setInterval(fetchBopisDeliveryData, 300000); // Fetch every 5 minutes (300000ms)
      return () => clearInterval(interval); // Cleanup interval on component unmount
    }
  }, [stsTileEnable]);

  // useEffect(() => {
  //   if (checkConfig) {
  //     if (sddTile && !bopisTile) {
  //       handleNavigateToSDD();
  //     } else if (bopisTile && !sddTile) {
  //       handleNavigateToBopisDelivery();
  //     }
  //   }
  // }, [checkConfig])

  const backFromSDD = () => {
      setLoading(true);
      api.navigation.navigate('Home');
      setLoading(false);
  };
  const backFromBopis = () => {
      setLoading(true);
      api.navigation.navigate('Home');
      setLoading(false);
  }

  const backFromBopisDelivery = () => {
      setLoading(true);
      api.navigation.navigate('BOPIS Dashboard');
      setLoading(false);
    
  }

  // Helper function to calculate remaining time or overdue time
  const calculateTimeRemaining = (
    orderDate: string,
    slaTime: number,
    timeZone: string,
    shipmentType: string,
    regularHours: Record<string, { openAt: string; closeAt: string }>
  ) => {
    const orderDateTime = new Date(orderDate).getTime();
    const currentTime = new Date().toLocaleString('en-US', { timeZone });
    const currentDateTime = new Date(currentTime).getTime();

    if (shipmentType === 'SAMEDAY_DELIVERY') {
      const slaEndTime = orderDateTime + slaTime * 60 * 1000; // SLA end time in milliseconds

      if (currentDateTime < slaEndTime) {
        const remainingTime = Math.floor((slaEndTime - currentDateTime) / (60 * 1000));
        return remainingTime < 60
          ? `${remainingTime} Min`
          : `${Math.floor(remainingTime / 60)} Hour${Math.floor(remainingTime / 60) > 1 ? 's' : ''} ${remainingTime % 60} Min`;
      } else {
        const overdueMinutes = Math.floor((currentDateTime - slaEndTime) / (60 * 1000));

        if (overdueMinutes >= 1440) {
          const overdueDays = Math.floor(overdueMinutes / 1440);
          return `Overdue by ${overdueDays} Day${overdueDays > 1 ? 's' : ''}`;
        } else {
          const overdueHours = Math.floor(overdueMinutes / 60);
          const remainingMinutes = overdueMinutes % 60;
          return overdueHours > 0
            ? `Overdue by ${overdueHours} Hour${overdueHours > 1 ? 's' : ''} ${remainingMinutes} Min`
            : `Overdue by ${overdueMinutes} Min`;
        }
      }
    } else if (shipmentType === 'NEXTDAY_DELIVERY') {
      const orderDateObj = new Date(orderDate);
      orderDateObj.setDate(orderDateObj.getDate() + 1); // Move to the next day

      // Get the next day's weekday name
      const nextDay = orderDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      const storeHours = regularHours[nextDay];

      // Default open time to 10:00 AM if missing or closed
      const openAtTime = storeHours && storeHours.openAt !== 'closed'
        ? storeHours.openAt
        : '10:00';

      const openAt = new Date(orderDateObj);
      openAt.setHours(parseInt(openAtTime.split(':')[0], 10), parseInt(openAtTime.split(':')[1], 10));

      // SLA end time based on `openAt` + `slaTime`
      const slaEndTime = openAt.getTime() + slaTime * 60 * 1000;

      if (currentDateTime < openAt.getTime()) {
        return '--';
      }

      if (currentDateTime >= openAt.getTime() && currentDateTime <= slaEndTime) {
        const remainingMinutes = Math.floor((slaEndTime - currentDateTime) / (60 * 1000));
        const remainingHours = Math.floor(remainingMinutes / 60);
        const extraMinutes = remainingMinutes % 60;
        return remainingHours > 0
          ? `${remainingHours} Hour${remainingHours > 1 ? 's' : ''} ${extraMinutes} Min`
          : `${extraMinutes} Min`;
      }

      if (currentDateTime > slaEndTime) {
        const overdueMinutes = Math.floor((currentDateTime - slaEndTime) / (60 * 1000));

        if (overdueMinutes >= 1440) {
          const overdueDays = Math.floor(overdueMinutes / 1440);
          return `Overdue by ${overdueDays} Day${overdueDays > 1 ? 's' : ''}`;
        } else {
          const overdueHours = Math.floor(overdueMinutes / 60);
          const extraMinutes = overdueMinutes % 60;
          return overdueHours > 0
            ? `Overdue by ${overdueHours} Hour${overdueHours > 1 ? 's' : ''} ${extraMinutes} Min`
            : `Overdue by ${extraMinutes} Min`;
        }
      }
    }

    return 'N/A';
  };

  const handleNavigateToSDD = async () => {
    setLoading(true);
    api.navigation.navigate('SDD', { fulfillmentType: 'DELIVERY' });
  };

  const handleNavigateToBopisDashboard = async () => {
    setLoading(true);
    api.navigation.navigate('BOPIS', { fulfillmentType: 'DASHBOARD' });
  };

  const handleNavigateToBopisDelivery = async () => {
    setLoading(true);
    api.navigation.navigate('BOPISDELIVERY', { fulfillmentType: 'PICKUP' });
  };

  const handleNavigateToBopisPickup = async () => {
    setLoading(true);
    api.navigation.navigate('BOPISPICKUP', { fulfillmentType: 'PICKUP' });
  };

  const handleNavigateToBopis = async () => {
    setLoading(false);
    api.navigation.navigate('BOPIS', { fulfillmentType: 'PICKUP' });
  };

  const renderOrderDetails = (orders, STS=false) => (
    <Section>
      <Stack direction={'inline'}
        justifyContent="space-evenly" gap="200" flexChildren paddingBlock={"400"} paddingInlineStart={isTablet ? '1200' : '400'} paddingInlineEnd={isTablet ? '1200' : '400'}>
        <Text variant="captionMedium" color="TextNeutral">Order ID</Text>
        <Text variant="captionMedium" color="TextNeutral">Order Date</Text>
        <Text variant="captionMedium" color="TextNeutral">Time Remaining</Text>
      </Stack>
      {orders.map((order) => {
        let formattedOrderId;
        if(!STS) {
          formattedOrderId= order.orderId.split('_')[0];
        }else{
           formattedOrderId= order.orderId
        }
        const timeStatus = calculateTimeRemaining(
          order.orderDate,
          orderData.slaTime,
          orderData.timeZone,
          order.shipmentType,
          orderData.regularHours
        );
        const timeStatusColor = timeStatus.includes('Overdue')
          ? 'TextCritical'
          : timeStatus.includes('Min') && parseInt(timeStatus, 10) < 10
            ? 'TextWarning'
            : 'TextSuccess';

        return (
          <Selectable key={order.orderId} onPress={() => { }}>
            <Stack
              direction="inline" gap="200" justifyContent="space-evenly" flexChildren paddingBlock={"400"} paddingInlineStart={isTablet ? '1200' : '400'} paddingInlineEnd={isTablet ? '1200' : '400'}>
              <Text variant={isTablet ? "captionMedium" : "captionRegular"}>{formattedOrderId}</Text>
              <Text variant={isTablet ? "captionMedium" : "captionRegular"}>
                {new Date(order.orderDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })}
              </Text>
              <Text variant={isTablet ? "captionMedium" : "captionRegular"} color={timeStatusColor}>{timeStatus}</Text>
            </Stack>
          </Selectable>
        );
      })}
    </Section>
  );

  return (
    <Navigator>
      <Screen name="Home" title='OMNI' isLoading={loading}>
    
          <Stack
            direction="inline"
            justifyContent="space-evenly"
            alignContent="center"
            alignItems="center"
            inlineSize="100%"
            blockSize="75%"
          >

            <Selectable onPress={handleNavigateToSDD}>
              <Stack
                direction="inline" paddingBlock='400' alignContent="center" alignItems='center' justifyContent='center' paddingInline="500"
              >
                <OrderCountCard
                  count={''}
                  text={sddBadge > 0 ? `${sddBadge} Pending Orders` : 'No Pending Orders'}
                  type="OMNI"
                  color="SDD"
                  deviceName={isTablet}
                  badge={sddBadge}
                />
              </Stack>
            </Selectable>

            <Selectable onPress={stsTileEnable ? handleNavigateToBopis : handleNavigateToBopisPickup}>
              <Stack
                direction="inline" paddingBlock='400' alignContent="center" alignItems='center' justifyContent='center' paddingInline="500">
                <OrderCountCard
                  count={''}
                  text={bopisBadge > 0 ? `${bopisBadge} Pending Orders` : 'No Pending Orders'}
                  type="BOPIS"
                  color="Bopis"
                  deviceName={isTablet}
                  badge={bopisBadge}
                />
              </Stack>
            </Selectable>

           

          </Stack>

      </Screen>
      <Screen name="SDD" title="OMNI Dashboard" onNavigateBack={backFromSDD} isLoading={loading} onReceiveParams={(params) => {
        // If the Home screen sent {fulfillmentType: 'DELIVERY'}, we run fetchSddData
        if (params?.fulfillmentType === 'DELIVERY') {
          fetchSddData();
        }
      }}>

        {!loading && sddData && <ScrollView>
          <Section>
            {isTablet && (<Stack
              direction={"block"}
              paddingBlock="300"
            // paddingVertical='HalfPoint'
            ></Stack>)}
            <Stack
              direction={!isTablet ? 'block' : 'inline'}
              flexChildren
            // paddingVertical='HalfPoint'
            >
              {!isTablet ? (

                <Stack direction="inline" gap="200" justifyContent="center">
                  <Stack direction="inline" inlineSize="100%" justifyContent="space-evenly">
                    <OrderCountCard
                      count={sddData.currentDayOrderCount}
                      type="Total Orders"
                      color="green"
                      deviceName={isTablet}
                    />
                    <OrderCountCard
                      count={sddData.openOrderCount}
                      type="Open Orders"
                      color="red"
                      deviceName={isTablet}
                    />

                  </Stack>
                  <Stack direction="inline" inlineSize="100%" justifyContent="space-evenly" >
                    <OrderCountCard
                      count={sddData.pickPackOrderCount}
                      type="In Progress"
                      color="yellow"
                      deviceName={isTablet}
                    />
                    <OrderCountCard
                      count={sddData.completedOrderCount}
                      type="Completed Orders"
                      color="blue"
                      deviceName={isTablet}
                    />
                  </Stack>
                </Stack>
              ) : (

                <Stack direction="inline" justifyContent="space-evenly" flexChildren paddingInlineStart='200' paddingInlineEnd="200" alignContent='center' alignItems='center'>
                  <OrderCountCard
                    count={sddData.currentDayOrderCount}
                    type="Total Orders"
                    color="green"
                    deviceName={isTablet}
                  />
                  <OrderCountCard
                    count={sddData.openOrderCount}
                    type="Open Orders"
                    color="red"
                    deviceName={isTablet}
                  />

                  <OrderCountCard
                    count={sddData.pickPackOrderCount}
                    type="In Progress"
                    color="yellow"
                    deviceName={isTablet}
                  />
                  <OrderCountCard
                    count={sddData.completedOrderCount}
                    type="Completed Orders"
                    color="blue"
                    deviceName={isTablet}
                  />
                </Stack>
              )}
            </Stack>
          </Section>

          <SegmentedControl
            segments={[
              { id: 'openOrders', label: 'Open Delivery Orders', disabled: false },
              { id: 'readyForPickup', label: 'Ready for Pickup', disabled: false },
            ]}
            selected={selected}
            onSelect={setSelected}
          />
          {selected === 'openOrders'
            ? renderOrderDetails(sddData.openOrderDetails)
            : renderOrderDetails(sddData.readyForPickupOrderDetails)}
        </ScrollView>}
        {error && <ScrollView>

          <Banner
            title={error}
            variant="error"
            visible
          />


        </ScrollView>}
      </Screen>

      <Screen name="BOPIS" title="BOPIS Dashboard" isLoading={loading} onNavigateBack={backFromBopis}>
        {stsTileEnable &&<Stack
          direction="inline"
          justifyContent="space-evenly"
          alignContent="center"
          alignItems="center"
          inlineSize="100%"
          blockSize="75%"
        >

           <Selectable onPress={handleNavigateToBopisDelivery}>
            <Stack
              direction="inline" paddingBlock='400' alignContent="center" alignItems='center' justifyContent='center' paddingInline="500"
            >
              <OrderCountCard
                count={''}
                text={bopisDeliveryBadge > 0 ? `${bopisDeliveryBadge} Pending Orders` : 'No Pending Orders'}
                type="Instore STS"
                color="InStoreSTS"
                deviceName={isTablet}
                badge={bopisDeliveryBadge}
              />
            </Stack>
          </Selectable>

          <Selectable onPress={handleNavigateToBopisPickup}>
            <Stack
              direction="inline" paddingBlock='400' alignContent="center" alignItems='center' justifyContent='center' paddingInline="500">
              <OrderCountCard
                count={''}
                text={bopisPickupBadge > 0 ? `${bopisPickupBadge} Pending Orders` : 'No Pending Orders'}
                type="Instore PICKUP"
                color="InStorePickup"
                deviceName={isTablet}
                badge={bopisPickupBadge}
              />
            </Stack>
          </Selectable>
        </Stack>}
      </Screen>




      <Screen name="BOPISDELIVERY" title="InStore STS" isLoading={loading} onNavigateBack={backFromBopisDelivery} onReceiveParams={(params) => {
        // If the Home screen sent {fulfillmentType: 'DELIVERY'}, we run fetchSddData
        if (params?.fulfillmentType === 'PICKUP' && stsTileEnable) {
          fetchBopisDeliveryData();
        }
      }}>

        {!loading && bopisDeliveryData && <ScrollView>
          <Section>
            <Stack
              direction={!isTablet ? 'block' : 'inline'}
              flexChildren
            // paddingVertical='HalfPoint'
            >
              {!isTablet ? (
                <>
                  <Stack direction="inline" gap="200" justifyContent="center">
                    <Stack direction="inline" inlineSize="100%" justifyContent="space-evenly">
                      <OrderCountCard
                        count={bopisDeliveryData.currentDayOrderCount}
                        text={''}
                        type="Total Orders"
                        color="green"
                        deviceName={isTablet}
                      />
                      <OrderCountCard
                        count={bopisDeliveryData.openOrderCount}
                        text={''}
                        type="Open Orders"
                        color="red"
                        deviceName={isTablet}
                      />

                    </Stack>
                    <Stack direction="inline" inlineSize="100%" justifyContent="space-evenly">

                      <OrderCountCard
                        count={bopisDeliveryData.pickPackOrderCount}
                        text={''}
                        type="In Progress"
                        color="yellow"
                        deviceName={isTablet}
                      />
                        <OrderCountCard
                      count={bopisDeliveryData.inTransitOrderCount}
                      text={''}
                      type="In Transit"
                      color="purple"
                      deviceName={isTablet}
                    />
                     
                    </Stack>
                  </Stack>
                   <Stack direction="inline" inlineSize="100%" justifyContent="center">
                     <OrderCountCard
                        count={bopisDeliveryData.completedOrderCount}
                        text={''}
                        type="Completed Orders"
                        color="blue"
                        deviceName={isTablet}
                      />
                   </Stack>
                </>
              ) : (
                <Stack direction="inline" justifyContent="space-evenly" flexChildren paddingInlineStart='200' paddingInlineEnd="200" alignContent='center' alignItems='center'>
                  <OrderCountCard
                    count={bopisDeliveryData.currentDayOrderCount}
                    text={''}
                    type="Total Orders"
                    color="green"
                    deviceName={isTablet}
                  />
                  <OrderCountCard
                    count={bopisDeliveryData.openOrderCount}
                    text={''}
                    type="Open Orders"
                    color="red"
                    deviceName={isTablet}
                  />

                  <OrderCountCard
                    count={bopisDeliveryData.pickPackOrderCount}
                    text={''}
                    type="In Progress"
                    color="yellow"
                    deviceName={isTablet}
                  />
                   <OrderCountCard
                    count={bopisDeliveryData.inTransitOrderCount}
                    text={''}
                    type="In Transit"
                    color="purple"
                    deviceName={isTablet}
                  />
                  <OrderCountCard
                    count={bopisDeliveryData.completedOrderCount}
                    text={''}
                    type="Completed Orders"
                    color="blue"
                    deviceName={isTablet}
                  />
                </Stack>
              )}
            </Stack>
          </Section>

          <SegmentedControl
            segments={[
              { id: 'openOrders', label: 'Open STS Orders', disabled: false },
              { id: 'readyForPickup', label: 'Ready for Pickup', disabled: false },
            ]}
            selected={selected}
            onSelect={setSelected}
          />
          {selected === 'openOrders'
            ? renderOrderDetails(bopisDeliveryData.openOrderDetails,true)
            : renderOrderDetails(bopisDeliveryData.readyForPickupOrderDetails,true)}
        </ScrollView>}
        {error && <ScrollView>

          <Banner
            title={error}
            variant="error"
            visible
          />


        </ScrollView>}
      </Screen>

      <Screen name="BOPISPICKUP" title="InStore Pickup" isLoading={loading} onNavigateBack={backFromBopisDelivery} onReceiveParams={(params) => {
        // If the Home screen sent {fulfillmentType: 'DELIVERY'}, we run fetchSddData
        if (params?.fulfillmentType === 'PICKUP') {
          fetchBopisPickupData();
        }
      }}>

        {!loading && bopisPickupData && <ScrollView>
          <Section>
            <Stack
              direction={!isTablet ? 'block' : 'inline'}
              flexChildren
            // paddingVertical='HalfPoint'
            >
              {!isTablet ? (
                <>
                  <Stack direction="inline" gap="200" justifyContent="center">
                    <Stack direction="inline" inlineSize="100%" justifyContent="space-evenly">
                      <OrderCountCard
                        count={bopisPickupData.currentDayOrderCount}
                        text={''}
                        type="Total Orders"
                        color="green"
                        deviceName={isTablet}
                      />
                      <OrderCountCard
                        count={bopisPickupData.openOrderCount}
                        text={''}
                        type="Open Orders"
                        color="red"
                        deviceName={isTablet}
                      />

                    </Stack>
                    <Stack direction="inline" inlineSize="100%" justifyContent="space-evenly">

                      <OrderCountCard
                        count={bopisPickupData.pickPackOrderCount}
                        text={''}
                        type="In Progress"
                        color="yellow"
                        deviceName={isTablet}
                      />
                      <OrderCountCard
                        count={bopisPickupData.completedOrderCount}
                        text={''}
                        type="Completed Orders"
                        color="blue"
                        deviceName={isTablet}
                      />
                    </Stack>
                  </Stack>
                </>
              ) : (
                <Stack direction="inline" justifyContent="space-evenly" flexChildren paddingInlineStart='200' paddingInlineEnd="200" alignContent='center' alignItems='center'>
                  <OrderCountCard
                    count={bopisPickupData.currentDayOrderCount}
                    text={''}
                    type="Total Orders"
                    color="green"
                    deviceName={isTablet}
                  />
                  <OrderCountCard
                    count={bopisPickupData.openOrderCount}
                    text={''}
                    type="Open Orders"
                    color="red"
                    deviceName={isTablet}
                  />

                  <OrderCountCard
                    count={bopisPickupData.pickPackOrderCount}
                    text={''}
                    type="In Progress"
                    color="yellow"
                    deviceName={isTablet}
                  />
                  <OrderCountCard
                    count={bopisPickupData.completedOrderCount}
                    text={''}
                    type="Completed Orders"
                    color="blue"
                    deviceName={isTablet}
                  />
                </Stack>
              )}
            </Stack>
          </Section>

          <SegmentedControl
            segments={[
              { id: 'openOrders', label: 'Open InStore Pickup Orders', disabled: false },
              { id: 'readyForPickup', label: 'Ready for Pickup', disabled: false },
            ]}
            selected={selected}
            onSelect={setSelected}
          />
          {selected === 'openOrders'
            ? renderOrderDetails(bopisPickupData.openOrderDetails)
            : renderOrderDetails(bopisPickupData.readyForPickupOrderDetails)}
        </ScrollView>}
        {error && <ScrollView>

          <Banner
            title={error}
            variant="error"
            visible
          />


        </ScrollView>}
      </Screen>

      

    </Navigator >
  );
};

export default reactExtension('pos.home.modal.render', () => <Modal />);
