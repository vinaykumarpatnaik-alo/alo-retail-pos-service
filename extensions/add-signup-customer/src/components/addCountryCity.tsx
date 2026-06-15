import React, { useState, useMemo } from "react";
import {
  Screen,
  ScrollView,
  Stack,
  Text,
  SearchBar,
  Selectable,
  Section,
  Icon,
  Button,
  TextField,
  useApi,
} from "@shopify/ui-extensions-react/point-of-sale";
import { COUNTRIES, CountryEntry } from "./helpers/countriesData";

export const AddCountryCity = () => {
  const api = useApi<"pos.home.modal.render">();

  const [countrySearch, setCountrySearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryEntry | null>(
    null,
  );
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showCountry, setShowCountry] = useState(true);
  const [showCity, setShowCity] = useState(false);
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [customCity, setCustomCity] = useState("");
  const [initialSelection, setInitialSelection] = useState({
    country: "",
    city: "",
    confirmed: false,
  });

  const filteredCountries = useMemo(
    () =>
      COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.trim().toLowerCase()),
      ),
    [countrySearch],
  );

  const filteredCities = useMemo(() => {
    if (!selectedCountry) return [];
    return selectedCountry.cities.filter((city) =>
      city.toLowerCase().includes(citySearch.trim().toLowerCase()),
    );
  }, [selectedCountry, citySearch]);

  const handleCountrySelect = (country: CountryEntry) => {
    setSelectedCountry(country);
    setSelectedCity(null);
    setCitySearch("");
    setIsOtherSelected(false);
    setCustomCity("");
    setShowCountry(false);
    setShowCity(true);
  };

  const handleCitySelect = (city: string) => {
    setIsOtherSelected(false);
    setCustomCity("");
    setSelectedCity(city);
  };

  const handleOtherSelect = () => {
    setIsOtherSelected(true);
    setSelectedCity(null);
    setCustomCity("");
  };

  const handleProceed = () => {
    const city = isOtherSelected ? customCity.trim() : (selectedCity ?? "");
    const country = selectedCountry?.name ?? "";
    setShowCity(false);
    api.navigation.navigate("ScreenOne", {
      country,
      city,
      touristSelectionConfirmed: true,
    });
  };

  const reset = () => {
    setSelectedCountry(null);
    setSelectedCity(null);
    setCountrySearch("");
    setCitySearch("");
    setIsOtherSelected(false);
    setCustomCity("");
    setShowCountry(true);
    setShowCity(false);
  };

  const backToHome = () => {
    api.navigation.navigate("ScreenOne", {
      country: initialSelection.country,
      city: initialSelection.city,
      touristSelectionConfirmed: initialSelection.confirmed,
    });
  };

  let cityLabel: React.ReactNode;

  if (selectedCountry === null) {
    cityLabel = (
      <Text variant="sectionHeader" color="TextDisabled">
        City
      </Text>
    );
  } else if (selectedCity === null) {
    cityLabel = (
      <Text variant="sectionHeader" color="TextInteractive">
        City
      </Text>
    );
  } else {
    cityLabel = (
      <Text variant="captionRegular" color="TextDisabled">
        City
      </Text>
    );
  }

  return (
    <Screen
      name="CountryList"
      title="Select Location"
      onNavigateBack={backToHome}
      onReceiveParams={(params: Record<string, any>) => {
        const incomingCountry = params?.country ?? "";
        const incomingCity = params?.city ?? "";
        const touristSelectionConfirmed =
          params?.touristSelectionConfirmed === true ||
          params?.touristSelectionConfirmed === "true";

        setInitialSelection({
          country: touristSelectionConfirmed ? incomingCountry : "",
          city: touristSelectionConfirmed ? incomingCity : "",
          confirmed: touristSelectionConfirmed,
        });

        if (!touristSelectionConfirmed || (!incomingCountry && !incomingCity)) {
          // Cleared from parent — reset everything
          setSelectedCountry(null);
          setSelectedCity(null);
          setCountrySearch("");
          setCitySearch("");
          setIsOtherSelected(false);
          setCustomCity("");
          setShowCountry(true);
          setShowCity(false);
        } else {
          // Pre-select existing values
          const found = COUNTRIES.find((c) => c.name === incomingCountry) ?? null;
          setSelectedCountry(found);
          setSelectedCity(incomingCity || null);
          setIsOtherSelected(false);
          setCustomCity("");
          setCitySearch("");
          setCountrySearch("");
          setShowCountry(false);
          setShowCity(true);
        }
      }}
      presentation={{ sheet: true }}
    >
      {/* ── Accordion header tabs ── */}
      <Stack direction="horizontal" flexChildren paddingBlock="100" gap="100">
        {/* Country tab */}
        <Section>
          <Selectable
            onPress={() => {
              setShowCity(false);
              setShowCountry((prev) => !prev);
            }}
          >
            <Stack
              direction="horizontal"
              paddingHorizontal="Small"
              alignment="space-between"
              paddingVertical="Small"
            >
              <Stack direction="vertical" alignContent="center">
                {selectedCountry === null ? (
                  <Text variant="sectionHeader" color="TextInteractive">
                    Country
                  </Text>
                ) : (
                  <Text variant="captionRegular" color="TextDisabled">
                    Country
                  </Text>
                )}
                {selectedCountry !== null && (
                  <Text variant="captionRegular" color="TextSuccess">
                    {selectedCountry.flag} {selectedCountry.name}
                  </Text>
                )}
              </Stack>
              <Stack direction="horizontal" flex={1} alignContent="center">
                {showCountry ? (
                  <Icon name="chevron-down" />
                ) : (
                  <Icon name="chevron-right" />
                )}
              </Stack>
            </Stack>
          </Selectable>
        </Section>

        {/* City tab */}
        <Section>
          <Selectable
            onPress={() => {
              setShowCountry(false);
              setShowCity(true);
            }}
            disabled={selectedCountry === null}
          >
            <Stack
              direction="horizontal"
              alignment="space-between"
              paddingHorizontal="Small"
              paddingVertical="Small"
            >
              <Stack direction="vertical" alignContent="center">
                {cityLabel}
                {selectedCity !== null && (
                  <Text variant="captionRegular" color="TextSuccess">
                    {selectedCity}
                  </Text>
                )}
              </Stack>
              <Stack direction="horizontal" flex={1} alignContent="center">
                {showCity ? (
                  <Icon name="chevron-down" />
                ) : (
                  <Icon name="chevron-right" />
                )}
              </Stack>
            </Stack>
          </Selectable>
        </Section>
      </Stack>

      {/* ── Static search bar (outside ScrollView so it doesn't scroll) ── */}
      {showCountry && (
        <Stack
          direction="horizontal"
          flexChildren
          paddingInline="450"
          paddingBlock="200"
          paddingHorizontal="Small"
        >
          <SearchBar
            onSearch={(value) => setCountrySearch(value ?? "")}
            onTextChange={(value) => setCountrySearch(value ?? "")}
            editable
            initialValue=""
            placeholder="Search country"
          />
        </Stack>
      )}
      {showCity && selectedCountry && (
        <Stack
          direction="horizontal"
          flexChildren
          paddingInline="450"
          paddingBlock="200"
          paddingHorizontal="Small"
        >
          <SearchBar
            onSearch={(value) => { setCitySearch(value ?? ""); setIsOtherSelected(false); setCustomCity(""); }}
            onTextChange={(value) => { setCitySearch(value ?? ""); setIsOtherSelected(false); setCustomCity(""); }}
            editable
            initialValue=""
            placeholder="Search city"
          />
        </Stack>
      )}

      {/* ── Scrollable list ── */}
      <ScrollView>
        {/* Country list */}
        {showCountry && (
          <Stack direction="horizontal" flexChildren paddingInline="025">
            <Section>
              {filteredCountries.map((country) => (
                <Selectable
                  key={country.isoCode}
                  onPress={() => handleCountrySelect(country)}
                >
                  <Stack
                    direction="horizontal"
                    alignment="space-between"
                    paddingVertical="Medium"
                    paddingInline="025"
                  >
                    <Stack
                      direction="horizontal"
                      gap="200"
                      alignContent="center"
                    >
                      <Text variant="captionRegular">{country.flag}</Text>
                      <Text
                        variant={selectedCountry?.isoCode === country.isoCode ? "captionMedium" : "captionRegular"}
                        color={selectedCountry?.isoCode === country.isoCode ? "TextInteractive" : undefined}
                      >
                        {country.name}
                      </Text>
                    </Stack>
                    <Icon name="chevron-right" />
                  </Stack>
                </Selectable>
              ))}
            </Section>
          </Stack>
        )}

        {/* City list */}
        {showCity && selectedCountry && (
          <Stack direction="horizontal" flexChildren paddingInline="025">
            <Section>
              {!isOtherSelected &&
                filteredCities.map((city) => (
                  <Selectable key={city} onPress={() => handleCitySelect(city)}>
                    <Stack
                      direction="horizontal"
                      alignment="space-between"
                      paddingVertical="Medium"
                      paddingInline="025"
                    >
                      <Text
                        variant={selectedCity === city ? "captionMedium" : "captionRegular"}
                        color={selectedCity === city ? "TextInteractive" : undefined}
                      >
                        {city}
                      </Text>
                      <Icon name="chevron-right" />
                    </Stack>
                  </Selectable>
                ))}

              {/* Other — always last */}
              <Selectable onPress={handleOtherSelect}>
                <Stack
                  direction="horizontal"
                  alignment="space-between"
                  paddingVertical="Medium"
                  paddingInline="025"
                >
                  <Text
                    variant="captionRegular"
                    color={isOtherSelected ? "TextInteractive" : undefined}
                  >
                    Other
                  </Text>
                  <Icon name="chevron-right" />
                </Stack>
              </Selectable>

              {/* Custom city input at top when Other is selected */}
              {isOtherSelected && (
                <Stack
                  direction="vertical"
                  paddingVertical="Small"
                  paddingInline="025"
                  gap="100"
                >
                  <TextField
                    label="Enter city name"
                    value={customCity}
                    onChange={(value) => setCustomCity(value ?? "")}
                    placeholder="Type your city"
                  />
                </Stack>
              )}
            </Section>
          </Stack>
        )}
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
        <Button title="Reset" type="basic" onPress={reset} isDisabled={!selectedCountry && !selectedCity} />
        <Button
          title="Proceed"
          type="primary"
          onPress={handleProceed}
        />
      </Stack>
    </Screen>
  );
};
