import React, { useEffect, useState } from 'react';
import { Text, Screen, useApi, Icon, Button, ScrollView, Selectable, useLocaleSubscription, Section, Stack } from '@shopify/ui-extensions-react/point-of-sale';
import ENjsonData from '../../locales/en.json';
import FRcajsonData from '../../locales/fr-ca.json';
import { useConfig } from '../../../pos-cart-utils/context/ConfigProvider';
import { calculateMaxYear } from '../utils/ageCalculation';

export const AddBirthday = () => {
  const api = useApi<'pos.home.modal.render'>();
  const { name } = api.device;
  const isIpad = name === 'iPad';

  // Age range config from Dynamo via ConfigProvider
  const { flags } = useConfig();
  const isAgeRangeEnabled = flags.showAgeRange ?? false;
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [nameOfMonth, setNameOfMonth] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [showMonth, setShowMonth] = useState<boolean>(true);
  const [showDay, setShowDay] = useState<boolean>(false);
  const [showYear, setShowYear] = useState<boolean>(false);
  const [messages, setMessages] = useState<any>('');
  const locale = useLocaleSubscription();

  useEffect(() => {
    const fetchData = async () => {
      let response = await ENjsonData.main;
      if (locale.includes('fr-CA')) {
        response = await FRcajsonData.main;
      }
      setMessages(response)
    };
    fetchData();
  }, []);

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const minYear = 1921;

  const maxYear = React.useMemo(
    () => calculateMaxYear(selectedMonth, selectedDay),
    [selectedMonth, selectedDay]
  );

  const years = React.useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index),
    [maxYear]
  );

  const handleMonthSelect = (month: string) => {
    const monthIndex = months.indexOf(month);
    setSelectedMonth(monthIndex + 1);
    setNameOfMonth(month);
    const year = 1920;
    const totalDays = daysInMonth(monthIndex + 1, year);
    const daysArray = Array.from({ length: totalDays }, (_, index) => index + 1);
    setSelectedDay(null);
    setSelectedYear(null);
    setDays(daysArray);
    setShowMonth(false);
    setShowDay(true);
    setShowYear(false);
  };

  const handleDaySelect = (day: number) => {
    setSelectedDay(day);
    setSelectedYear(null);
    setShowDay(false);
    if (isAgeRangeEnabled) {
      setShowYear(true);
    }
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);

    if (selectedMonth !== null) {
      const totalDays = daysInMonth(selectedMonth, year);
      const daysArray = Array.from({ length: totalDays }, (_, index) => index + 1);
      setDays(daysArray);
      if (selectedDay !== null && selectedDay > totalDays) {
        setSelectedDay(totalDays);
      }
    }

    setShowYear(false);
  };

  const handleProceed = () => {
    if (selectedMonth === null || selectedDay === null) return;
    api.navigation.pop();
    setTimeout(() => {
      const yearToSend = selectedYear === null ? 1920 : selectedYear;
      api.navigation.navigate('ScreenOne', {
        month: selectedMonth,
        day: selectedDay,
        year: yearToSend,
      });
    }, 0);
  };

  const daysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  };

  const reset = () => {
    setSelectedMonth(null);
    setSelectedDay(null);
    setSelectedYear(null);
    setNameOfMonth('');
    setShowMonth(true);
    setShowDay(false);
    setShowYear(false);
  }

  return (
    <Screen
      name="ScreenTwo"
      title={messages.Birthday}
      presentation={{ sheet: true }}
      onReceiveParams={(params: Record<string, any>) => {
        const incomingMonth = params?.month ? Number(params.month) : null;
        const incomingDay = params?.day ? Number(params.day) : null;
        const incomingYear = params?.year ? Number(params.year) : null;
        const normalizedYear = incomingYear === 1920 ? null : incomingYear;

        setSelectedMonth(incomingMonth);
        setSelectedDay(incomingDay);
        setSelectedYear(normalizedYear);

        if (incomingMonth !== null && incomingMonth >= 1 && incomingMonth <= 12) {
          setNameOfMonth(months[incomingMonth - 1]);
          const yearForDays = normalizedYear ?? 1920;
          const totalDays = daysInMonth(incomingMonth, yearForDays);
          setDays(Array.from({ length: totalDays }, (_, index) => index + 1));
          setSelectedDay(
            incomingDay !== null && incomingDay > totalDays ? totalDays : incomingDay,
          );
        } else {
          setNameOfMonth('');
          setDays([]);
        }

        setShowMonth(incomingMonth === null);
        setShowDay(incomingMonth !== null && incomingDay === null);
        setShowYear(isAgeRangeEnabled && incomingMonth !== null && incomingDay !== null);
      }}
    >
      {/* Header row: show month + day only, or month + day + year based on flag */}
      <Stack direction="inline" flexChildren gap="100" alignItems='center' >
        <Section>
          <Selectable
            onPress={() => {
              setShowDay(false);
              setShowMonth(true);
            }}
          >
          <Stack
              direction="horizontal"
              paddingHorizontal="Small"
              alignment="space-between"
              paddingVertical="Small"
            >
              <Stack direction="vertical" alignContent="center">
                {selectedMonth == null ? (
                  <Text children="Month" variant="sectionHeader" color="TextInteractive" />
                ) : (
                  <Text children="Month" variant="captionRegular" color="TextDisabled" />
                )}
                {selectedMonth !== null && (
                  <Text children={nameOfMonth} variant="captionRegular" color="TextSuccess" />
                )}
              </Stack>
              <Stack direction="horizontal" flex={3} alignContent="center">
                <Stack
                  direction="horizontal"
                  inlineSize="450"
                  alignContent="center"
                >
                  {!showMonth ? (
                    <Icon name="chevron-right" />
                  ) : (
                    <Icon name="chevron-down" />
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Selectable>
        </Section>
        <Section>
          <Selectable
            onPress={() => {
              setShowMonth(false);
              setShowDay(true);
            }}
            disabled={selectedMonth === null ? true : false}
          >
            <Stack
              direction="horizontal"
              paddingHorizontal="Small"
              alignment="space-between"
              paddingVertical="Small"
            >
              <Stack direction="vertical" gap={0.5}>
                {selectedMonth !== null ? (
                  selectedDay !== null ? (
                    <Text children="Day" variant="captionRegular" color="TextDisabled" />
                  ) : (
                    <Text children="Day" variant="sectionHeader" color="TextInteractive" />
                  )
                ) : (
                  <Text children="Day" variant="sectionHeader" color="TextDisabled" />
                )}
                {selectedDay !== null && (
                  <Text children={selectedDay} variant="captionRegular" color="TextSuccess" />
                )}
              </Stack>
              <Stack direction="vertical" flex={1} justifyContent="center">
                <Stack direction="horizontal" gap="0" alignContent="center">
                  {showDay ? (
                    <Icon name="chevron-down" />
                  ) : (
                    <Icon name="chevron-right" />
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Selectable>
        </Section>

        {isAgeRangeEnabled && (
          <Section>
            <Selectable
              onPress={() => {
                setShowMonth(false);
                setShowDay(false);
                setShowYear(true);
              }}
              disabled={selectedMonth === null || selectedDay === null}
            >
              <Stack
                direction="horizontal"
                paddingHorizontal="Small"
                alignment="space-between"
                paddingVertical="Small"
              >
                <Stack direction="vertical" gap={0.5}>
                  {selectedYear == null ? (
                    <Text variant="sectionHeader" color="TextDisabled">Year</Text>
                  ) : (
                    <Text variant="captionRegular" color="TextInteractive">Year</Text>
                  )}
                  {selectedYear !== null && <Text variant="captionRegular" color="TextSuccess">{selectedYear}</Text>}
                </Stack>
                <Stack direction="vertical" flex={1} justifyContent="center">
                  <Stack direction="horizontal" gap="0" alignContent="center">
                    {showYear ? (
                      <Icon name="chevron-down" />
                    ) : (
                      <Icon name="chevron-right" />
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </Selectable>
          </Section>
        )}
      </Stack>
      <ScrollView>
        <Stack direction="inline" flexChildren paddingInline='0'>
          {showMonth && (
            <Section>
              {months.map((month) => (
                <Selectable key={month} onPress={() => handleMonthSelect(month)}>
                  <Stack
                    direction="horizontal"
                    alignment="space-between"
                    paddingVertical={"Medium"}
                    paddingInline={"Small"}
                  >
                    <Stack direction="vertical" gap={0.5}>
                      <Text>{month}</Text>
                    </Stack>
                    <Stack direction="vertical" justifyContent="center">
                      <Icon name="chevron-right" />
                    </Stack>
                  </Stack>
                </Selectable>
              ))}
            </Section>
          )}
        </Stack>
        <Stack direction="horizontal" flexChildren paddingInline={"Small"}>
          <Stack direction="vertical">
            <ScrollView>
              {showDay && (
                <Section>
                  {days.map((day) => (
                    <Selectable key={day} onPress={() => handleDaySelect(day)}>
                      <Stack
                        direction="horizontal"
                        alignment="space-between"
                        paddingVertical={"Medium"}
                        paddingInline={"Small"}
                      >
                        <Stack direction="vertical" gap={0.5}>
                          <Text>{day}</Text>
                        </Stack>
                        <Stack direction="vertical" justifyContent="center">
                          <Icon name="chevron-right" />
                        </Stack>
                      </Stack>
                    </Selectable>
                  ))}
                </Section>
              )}
            </ScrollView>
          </Stack>
        </Stack>
        <Stack direction="horizontal" flexChildren paddingInline={"Small"}>
          <Stack direction="vertical">
            <ScrollView>
              {isAgeRangeEnabled && showYear && (
                <Section>
                  {years.map((year) => (
                    <Selectable
                      key={year}
                      onPress={() => handleYearSelect(year)}
                    >
                      <Stack
                        direction="horizontal"
                        alignment="space-between"
                        paddingVertical={"Medium"}
                        paddingInline={"Small"}
                      >
                        <Stack direction="vertical" gap={0.5}>
                          <Text>{year}</Text>
                        </Stack>
                        <Stack direction="vertical" justifyContent="center">
                          <Icon name="chevron-right" />
                        </Stack>
                      </Stack>
                    </Selectable>
                  ))}
                </Section>
              )}
            </ScrollView>
          </Stack>
        </Stack>
      </ScrollView>
      <Section />
      <Stack
        direction="horizontal"
        flexChildren
        paddingVertical="Small"
        paddingHorizontal="Small"
        paddingInline="450"
        gap="200"
      >
        <Button title={"Reset"} type={"basic"} onPress={reset} />
        <Button
          title={"Proceed"}
          type={"primary"}
          onPress={handleProceed}
          isDisabled={selectedMonth === null || selectedDay === null}
        />
      </Stack>
    </Screen>
  );
};