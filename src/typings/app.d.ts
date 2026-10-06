/** The global namespace for the app */
declare namespace App {
  /** Theme namespace */
  namespace Theme {
    type ColorPaletteNumber = import('@sa/color').ColorPaletteNumber;

    /** Theme setting */
    interface ThemeSetting {
      /** Theme scheme */
      themeScheme: UnionKey.ThemeScheme;
      /** grayscale mode */
      grayscale: boolean;
      /** colour weakness mode */
      colourWeakness: boolean;
      /** Whether to recommend color */
      recommendColor: boolean;
      /** Theme color */
      themeColor: string;
      /** Other color */
      otherColor: OtherColor;
      /** Whether info color is followed by the primary color */
      isInfoFollowPrimary: boolean;
      /** Reset cache strategy */
      resetCacheStrategy: UnionKey.ResetCacheStrategy;
      /** Layout */
      layout: {
        /** Layout mode */
        mode: UnionKey.ThemeLayoutMode;
        /** Scroll mode */
        scrollMode: UnionKey.ThemeScrollMode;
        /**
         * Whether to reverse the horizontal mix
         *
         * if true, the vertical child level menus in left and horizontal first level menus in top
         */
        reverseHorizontalMix: boolean;
      };
      /** Page */
      page: {
        /** Whether to show the page transition */
        animate: boolean;
        /** Page animate mode */
        animateMode: UnionKey.ThemePageAnimateMode;
      };
      /** Header */
      header: {
        /** Header height */
        height: number;
        /** Header breadcrumb */
        breadcrumb: {
          /** Whether to show the breadcrumb */
          visible: boolean;
          /** Whether to show the breadcrumb icon */
          showIcon: boolean;
        };
      };
      /** Tab */
      tab: {
        /** Whether to show the tab */
        visible: boolean;
        /**
         * Whether to cache the tab
         *
         * If cache, the tabs will get from the local storage when the page is refreshed
         */
        cache: boolean;
        /** Tab height */
        height: number;
        /** Tab mode */
        mode: UnionKey.ThemeTabMode;
      };
      /** Fixed header and tab */
      fixedHeaderAndTab: boolean;
      /** Sider */
      sider: {
        /** Inverted sider */
        inverted: boolean;
        /** Sider width */
        width: number;
        /** Collapsed sider width */
        collapsedWidth: number;
        /** Sider width when the layout is 'vertical-mix' or 'horizontal-mix' */
        mixWidth: number;
        /** Collapsed sider width when the layout is 'vertical-mix' or 'horizontal-mix' */
        mixCollapsedWidth: number;
        /** Child menu width when the layout is 'vertical-mix' or 'horizontal-mix' */
        mixChildMenuWidth: number;
      };
      /** Footer */
      footer: {
        /** Whether to show the footer */
        visible: boolean;
        /** Whether fixed the footer */
        fixed: boolean;
        /** Footer height */
        height: number;
        /** Whether float the footer to the right when the layout is 'horizontal-mix' */
        right: boolean;
      };
      /** Watermark */
      watermark: {
        /** Whether to show the watermark */
        visible: boolean;
        /** Watermark text */
        text: string;
      };
      /** define some theme settings tokens, will transform to css variables */
      tokens: {
        light: ThemeSettingToken;
        dark?: {
          [K in keyof ThemeSettingToken]?: Partial<ThemeSettingToken[K]>;
        };
      };
    }

    interface OtherColor {
      info: string;
      success: string;
      warning: string;
      error: string;
    }

    interface ThemeColor extends OtherColor {
      primary: string;
    }

    type ThemeColorKey = keyof ThemeColor;

    type ThemePaletteColor = {
      [key in ThemeColorKey | `${ThemeColorKey}-${ColorPaletteNumber}`]: string;
    };

    type BaseToken = Record<string, Record<string, string>>;

    interface ThemeSettingTokenColor {
      /** the progress bar color, if not set, will use the primary color */
      nprogress?: string;
      container: string;
      layout: string;
      inverted: string;
      'base-text': string;
    }

    interface ThemeSettingTokenBoxShadow {
      header: string;
      sider: string;
      tab: string;
    }

    interface ThemeSettingToken {
      colors: ThemeSettingTokenColor;
      boxShadow: ThemeSettingTokenBoxShadow;
    }

    type ThemeTokenColor = ThemePaletteColor & ThemeSettingTokenColor;

    /** Theme token CSS variables */
    type ThemeTokenCSSVars = {
      colors: ThemeTokenColor & { [key: string]: string };
      boxShadow: ThemeSettingTokenBoxShadow & { [key: string]: string };
    };
  }

  /** Global namespace */
  namespace Global {
    type VNode = import('vue').VNode;
    type RouteLocationNormalizedLoaded = import('vue-router').RouteLocationNormalizedLoaded;
    type RouteKey = import('@elegant-router/types').RouteKey;
    type RouteMap = import('@elegant-router/types').RouteMap;
    type RoutePath = import('@elegant-router/types').RoutePath;
    type LastLevelRouteKey = import('@elegant-router/types').LastLevelRouteKey;

    /** The global header props */
    interface HeaderProps {
      /** Whether to show the logo */
      showLogo?: boolean;
      /** Whether to show the menu toggler */
      showMenuToggler?: boolean;
      /** Whether to show the menu */
      showMenu?: boolean;
    }

    /** The global menu */
    type Menu = {
      /**
       * The menu key
       *
       * Equal to the route key
       */
      key: string;
      /** The menu label */
      label: string;
      /** The menu i18n key */
      i18nKey?: I18n.I18nKey | null;
      /** The route key */
      routeKey: RouteKey;
      /** The route path */
      routePath: RoutePath;
      /** The menu icon */
      icon?: () => VNode;
      /** The tooltip title */
      title?: string;
      /** The menu children */
      children?: Menu[];
    };

    /** Tab route */
    type TabRoute = Pick<RouteLocationNormalizedLoaded, 'name' | 'path' | 'meta'> &
      Partial<Pick<RouteLocationNormalizedLoaded, 'fullPath' | 'query' | 'matched'>>;

    /** The global tab */
    type Tab = {
      /** The tab id */
      id: string;
      /** The tab label */
      label: string;
      /**
       * The new tab label
       *
       * If set, the tab label will be replaced by this value
       */
      newLabel?: string;
      /**
       * The old tab label
       *
       * when reset the tab label, the tab label will be replaced by this value
       */
      oldLabel?: string;
      /** The tab route key */
      routeKey: LastLevelRouteKey;
      /** The tab route path */
      routePath: RouteMap[LastLevelRouteKey];
      /** The tab route full path */
      fullPath: string;
      /** The tab fixed index */
      fixedIndex?: number | null;
      /**
       * Tab icon
       *
       * Iconify icon
       */
      icon?: string;
      /**
       * Tab local icon
       *
       * Local icon
       */
      localIcon?: string;
      /** I18n key */
      i18nKey?: I18n.I18nKey | null;
    };

    /** Form rule */
    type FormRule = import('ant-design-vue/es/form/interface.d.ts').Rule;

    /** The global dropdown key */
    type DropdownKey = 'closeCurrent' | 'closeOther' | 'closeLeft' | 'closeRight' | 'closeAll';
  }

  /**
   * I18n namespace
   *
   * Locales type
   */
  namespace I18n {
    type RouteKey = import('@elegant-router/types').RouteKey;

    type LangType = 'en-US' | 'zh-CN';

    type LangOption = {
      label: string;
      key: LangType;
    };

    type I18nRouteKey = Exclude<RouteKey, 'root' | 'not-found'>;

    type FormMsg = {
      required: string;
      invalid: string;
    };

    /**
     * 通用校验规则的提示文案
     *
     * 与具体字段无关（如长度上限、业务编码格式、数值区间），所以只有 invalid。
     * 字段级的文案仍用 FormMsg。
     */
    type RuleMsg = {
      invalid: string;
    };

    type Schema = {
      system: {
        title: string;
        updateTitle: string;
        updateContent: string;
        updateConfirm: string;
        updateCancel: string;
      };
      common: {
        about: string;
        action: string;
        add: string;
        addSuccess: string;
        addFailed: string;
        backToHome: string;
        batchDelete: string;
        cancel: string;
        close: string;
        check: string;
        columnSetting: string;
        config: string;
        confirm: string;
        delete: string;
        deleteSuccess: string;
        deleteFailed: string;
        confirmDelete: string;
        confirmImport: string;
        download: string;
        edit: string;
        error: string;
        exportFailed: string;
        generate: string;
        importHint: string;
        importSuccess: string;
        importTemplate: string;
        importErrorColumn: string;
        importPreviewEmpty: string;
        importPreviewSummary: string;
        importRowOk: string;
        index: string;
        invalidFileType: string;
        keywordSearch: string;
        logout: string;
        logoutConfirm: string;
        lookForward: string;
        modify: string;
        modifySuccess: string;
        more: string;
        noData: string;
        operate: string;
        pleaseCheckValue: string;
        refresh: string;
        reset: string;
        search: string;
        selectFile: string;
        switch: string;
        tip: string;
        trigger: string;
        update: string;
        updateSuccess: string;
        updateFailed: string;
        uploadCountLimited: string;
        uploadDragHint: string;
        uploadRetry: string;
        uploadSizeLimited: string;
        uploadTypeLimited: string;
        userCenter: string;
        yesOrNo: {
          yes: string;
          no: string;
        };
        totalItems: string;
      };
      request: {
        logout: string;
        logoutMsg: string;
        logoutWithModal: string;
        logoutWithModalMsg: string;
        refreshToken: string;
        tokenExpired: string;
      };
      theme: {
        themeSchema: { title: string } & Record<UnionKey.ThemeScheme, string>;
        grayscale: string;
        colourWeakness: string;
        layoutMode: { title: string; reverseHorizontalMix: string } & Record<UnionKey.ThemeLayoutMode, string>;
        recommendColor: string;
        recommendColorDesc: string;
        themeColor: {
          title: string;
          followPrimary: string;
        } & Record<Theme.ThemeColorKey, string>;
        scrollMode: { title: string } & Record<UnionKey.ThemeScrollMode, string>;
        page: {
          animate: string;
          mode: { title: string } & Record<UnionKey.ThemePageAnimateMode, string>;
        };
        fixedHeaderAndTab: string;
        header: {
          height: string;
          breadcrumb: {
            visible: string;
            showIcon: string;
          };
        };
        tab: {
          visible: string;
          cache: string;
          height: string;
          mode: { title: string } & Record<UnionKey.ThemeTabMode, string>;
        };
        sider: {
          inverted: string;
          width: string;
          collapsedWidth: string;
          mixWidth: string;
          mixCollapsedWidth: string;
          mixChildMenuWidth: string;
        };
        footer: {
          visible: string;
          fixed: string;
          height: string;
          right: string;
        };
        watermark: {
          visible: string;
          text: string;
        };
        themeDrawerTitle: string;
        pageFunTitle: string;
        resetCacheStrategy: { title: string } & Record<UnionKey.ResetCacheStrategy, string>;
        configOperation: {
          copyConfig: string;
          copySuccessMsg: string;
          resetConfig: string;
          resetSuccessMsg: string;
        };
      };
      route: Record<I18nRouteKey, string>;
      page: {
        devkit: {
          common: {
            back: string;
            save: string;
            copy: string;
            size: string;
            enabled: string;
            disabled: string;
            createTime: string;
            updateTime: string;
            fileCount: string;
            duration: string;
            noPreview: string;
            binaryFile: string;
            selectFile: string;
          };
          datasource: {
            title: string;
            addTitle: string;
            editTitle: string;
            dsName: string;
            dsCode: string;
            dbType: string;
            host: string;
            port: string;
            address: string;
            databaseName: string;
            schemaName: string;
            schemaHint: string;
            username: string;
            password: string;
            passwordHint: string;
            passwordEditHint: string;
            jdbcParams: string;
            readOnly: string;
            remark: string;
            status: string;
            test: string;
            testSuccess: string;
            testFailed: string;
            form: {
              dsName: string;
              dbType: string;
              status: string;
            };
          };
          template: {
            title: string;
            addTitle: string;
            editTitle: string;
            copyTitle: string;
            groupCode: string;
            groupName: string;
            newGroupCode: string;
            newGroupName: string;
            copyFiles: string;
            copySuffix: string;
            templateType: string;
            typeCode: string;
            typeProject: string;
            techStack: string;
            dbType: string;
            templateRoot: string;
            sortNum: string;
            logicDeleteFields: string;
            versionFields: string;
            commonFields: string;
            fieldsHint: string;
            description: string;
            remark: string;
            status: string;
            fileCount: string;
            builtIn: string;
            editFiles: string;
            export: string;
            exportFailed: string;
            fileType: string;
            fileTypeTemplate: string;
            fileTypeStatic: string;
            form: {
              groupCode: string;
              groupName: string;
              templateType: string;
              status: string;
            };
          };
          codegen: {
            title: string;
            datasource: string;
            schema: string;
            templateGroup: string;
            projectName: string;
            packageName: string;
            author: string;
            nameType: string;
            nameTypeHint: string;
            useTablePrefix: string;
            tableSelection: string;
            tableName: string;
            tableComment: string;
            selectedCount: string;
            loadTables: string;
            previewTitle: string;
            preview: string;
            download: string;
            previewFailed: string;
            generateFailed: string;
            pickDatasourceFirst: string;
            pickTemplateFirst: string;
            pickTableFirst: string;
            form: {
              datasource: string;
              schema: string;
              templateGroup: string;
              keyword: string;
            };
          };
          project: {
            title: string;
            template: string;
            artifactId: string;
            artifactIdHint: string;
            projectName: string;
            projectNameHint: string;
            mavenGroupId: string;
            mavenGroupIdHint: string;
            version: string;
            author: string;
            describe: string;
            previewTitle: string;
            pickTemplateFirst: string;
            invalidArtifactId: string;
            missingGroupId: string;
            previewFailed: string;
            generateFailed: string;
            form: {
              template: string;
            };
          };
          record: {
            title: string;
            bizType: string;
            templateGroup: string;
            projectName: string;
            totalSize: string;
            duration: string;
            status: string;
            form: {
              bizType: string;
              projectName: string;
              status: string;
            };
          };
          editor: {
            newFile: string;
            versionHistory: string;
            renderPreview: string;
            filePath: string;
            filePathHint: string;
            initialContent: string;
            selectFileHint: string;
            missingGroup: string;
            tabTitle: string;
            loop: string;
            unsaved: string;
            unsavedTitle: string;
            unsavedContent: string;
            discard: string;
            manualSave: string;
            rollback: string;
            rollbackConfirm: string;
            rollbackSuccess: string;
            versionHint: string;
            versionNo: string;
            changeLog: string;
            compare: string;
            compareTitle: string;
            currentContent: string;
            versionContent: string;
            sampleTable: string;
            render: string;
            previewHint: string;
            previewFailed: string;
            previewRequired: string;
          };
        };
        agent: {
          title: string;
          subtitle: string;
          tip: string;
          placeholder: string;
          hint: string;
          send: string;
          newChat: string;
          fullscreen: string;
          exitFullscreen: string;
          copy: string;
          copied: string;
          toolSummary: string;
          thinking: string;
          failed: string;
          stopped: string;
          noResult: string;
          requestFailed: string;
          suggestion: {
            jobFail: string;
            recentCommits: string;
            redisStatus: string;
          };
        };
        login: {
          common: {
            loginOrRegister: string;
            userNamePlaceholder: string;
            phonePlaceholder: string;
            codePlaceholder: string;
            passwordPlaceholder: string;
            confirmPasswordPlaceholder: string;
            codeLogin: string;
            confirm: string;
            back: string;
            validateSuccess: string;
            loginSuccess: string;
            welcomeBack: string;
          };
          pwdLogin: {
            title: string;
            rememberMe: string;
            forgetPassword: string;
            register: string;
            otherAccountLogin: string;
            otherLoginMode: string;
            ssoLogin: string;
            superAdmin: string;
            admin: string;
            user: string;
            tenantCodePlaceholder: string;
            tenantCodeRequired: string;
          };
          codeLogin: {
            title: string;
            getCode: string;
            reGetCode: string;
            sendCodeSuccess: string;
            imageCodePlaceholder: string;
          };
          register: {
            title: string;
            agreement: string;
            protocol: string;
            policy: string;
          };
          resetPwd: {
            title: string;
          };
          bindWeChat: {
            title: string;
          };
          mfa: {
            title: string;
            desc: string;
            codePlaceholder: string;
            codeRequired: string;
            trustDevice: string;
            verify: string;
            hint: string;
          };
          oauth2Callback: {
            processing: string;
            authFailed: string;
            noCode: string;
            stateMismatch: string;
            userInfoFailed: string;
            tokenExchangeFailed: string;
            unexpected: string;
          };
        };
        about: {
          title: string;
          introduction: string;
          projectInfo: {
            title: string;
            name: string;
            desc: string;
            version: string;
            latestBuildTime: string;
            repository: string;
          };
          techStack: {
            title: string;
            framework: string;
            frontend: string;
            backend: string;
          };
        };
        home: {
          greetingMorning: string;
          greetingAfternoon: string;
          greetingEvening: string;
          bannerSubtitle: string;
          bannerProfile: string;
          bannerMonitor: string;
          starterCount: string;
          integrationCount: string;
          bomCount: string;
          jdkBaseline: string;
          quickNav: string;
          quickNavManage: string;
          quickNavDone: string;
          quickNavReset: string;
          quickNavAdd: string;
          quickNavSearch: string;
          quickNavAddEmpty: string;
          nav: {
            user: { title: string; desc: string };
            department: { title: string; desc: string };
            role: { title: string; desc: string };
            menu: { title: string; desc: string };
            dict: { title: string; desc: string };
            audit: { title: string; desc: string };
            message: { title: string; desc: string };
            job: { title: string; desc: string };
          };
          notice: string;
          noticeMore: string;
          noticeTop: string;
          noticeEmpty: string;
          noticeFavorite: string;
          noticeFavoriteCancel: string;
          noticeFavoriteFailed: string;
          monitorTitle: string;
          monitorTotal: string;
          monitorUp: string;
          monitorDown: string;
          monitorAlarm: string;
          monitorLink: string;
          monitorEmpty: string;
          projectTitle: string;
          projectVersion: string;
          projectStack: string;
          projectDesc: string;
          projectDocs: string;
          projectBackend: string;
          projectFrontend: string;
        };
        function: {
          tab: {
            tabOperate: {
              title: string;
              addTab: string;
              addTabDesc: string;
              closeTab: string;
              closeCurrentTab: string;
              closeAboutTab: string;
              addMultiTab: string;
              addMultiTabDesc1: string;
              addMultiTabDesc2: string;
            };
            tabTitle: {
              title: string;
              changeTitle: string;
              change: string;
              resetTitle: string;
              reset: string;
            };
          };
          multiTab: {
            routeParam: string;
            backTab: string;
          };
          toggleAuth: {
            toggleAccount: string;
            authHook: string;
            superAdminVisible: string;
            adminVisible: string;
            adminOrUserVisible: string;
          };
          request: {
            repeatedErrorOccurOnce: string;
            repeatedError: string;
            repeatedErrorMsg1: string;
            repeatedErrorMsg2: string;
          };
        };
        organization: {
          tenant: {
            title: string;
            tenantCode: string;
            tenantName: string;
            contactName: string;
            contactPhone: string;
            tenantStatus: string;
            expireTime: string;
            remark: string;
            neverExpire: string;
            disable: string;
            enable: string;
            initAdmin: string;
            initAdminTip: string;
            initAdminSuccess: string;
            initAdminFailed: string;
            adminAccount: string;
            adminNickname: string;
            adminPassword: string;
            adminPhone: string;
            form: {
              tenantCode: string;
              tenantCodeRule: string;
              tenantName: string;
              contactName: string;
              contactPhone: string;
              expireTime: string;
              remark: string;
              tenantStatus: string;
              account: string;
              accountRule: string;
              nickname: string;
              password: string;
              passwordRule: string;
              phone: string;
            };
            addTenant: string;
            editTenant: string;
          };
          role: {
            title: string;
            roleName: string;
            roleCode: string;
            roleStatus: string;
            roleDesc: string;
            form: {
              roleName: string;
              roleCode: string;
              roleStatus: string;
              roleDesc: string;
            };
            addRole: string;
            editRole: string;
            // 「角色状态变更」文案（另一在途批次新增，Schema 先行补齐以免 typecheck 红）
            stateChanged: string;
            menuAuth: string;
            buttonAuth: string;
            operationAuth: string;
          };
          user: {
            title: string;
            userName: string;
            userGender: string;
            nickName: string;
            userPhone: string;
            userEmail: string;
            userStatus: string;
            userRole: string;
            password: string;
            form: {
              userName: string;
              userGender: string;
              nickName: string;
              userPhone: string;
              userEmail: string;
              userStatus: string;
              userRole: string;
              roleExpireTime: string;
              password: string;
            };
            addUser: string;
            editUser: string;
            passwordRule: string;
            roleAssignFailed: string;
            roleExpireTime: string;
            roleExpireHint: string;
            resetPassword: string;
            newPassword: string;
            confirmPassword: string;
            resetPwdSuccess: string;
            unlock: string;
            stateChanged: string;
            resetPwdFor: string;
            importNotice: string;
            assignDept: string;
            userDept: string;
            mainDept: string;
            position: string;
            detail: string;
            detailTitle: string;
            createTime: string;
            historyTitle: string;
            historyEmpty: string;
            expireTime: string;
            rolePermanent: string;
            roleExpired: string;
            roleExpiringSoon: string;
            operator: string;
            deptAssignSuccess: string;
            deptRequired: string;
            deptAssignHint: string;
          };
          department: {
            title: string;
            deptName: string;
            deptCode: string;
            parentId: string;
            leaderId: string;
            orderNum: string;
            level: string;
            path: string;
            deptStatus: string;
            description: string;
            keyword: string;
            addDept: string;
            editDept: string;
            childDept: string;
            stateChanged: string;
            topLevel: string;
            expandAll: string;
            collapseAll: string;
            form: {
              parentId: string;
              deptName: string;
              deptCode: string;
              leaderId: string;
              orderNum: string;
              description: string;
            };
          };
          position: {
            title: string;
            positionCode: string;
            positionName: string;
            positionShort: string;
            categoryId: string;
            defaultLevelId: string;
            levelRange: string;
            positionType: string;
            positionNature: string;
            departmentId: string;
            parentId: string;
            topLevel: string;
            headcount: string;
            currentCount: string;
            vacancyCount: string;
            duty: string;
            requirement: string;
            qualification: string;
            kpiIndicator: string;
            costCenter: string;
            location: string;
            salaryGrade: string;
            positionStatus: string;
            addPosition: string;
            editPosition: string;
            form: {
              positionCode: string;
              positionName: string;
              positionShort: string;
              categoryId: string;
              defaultLevelId: string;
              levelRange: string;
              positionType: string;
              positionNature: string;
              departmentId: string;
              parentId: string;
              headcount: string;
              duty: string;
              requirement: string;
              qualification: string;
              kpiIndicator: string;
              costCenter: string;
              location: string;
              salaryGrade: string;
              positionStatus: string;
            };
          };
        };
        userCenter: {
          title: string;
          tabs: {
            profile: string;
            password: string;
            account: string;
          };
          avatar: string;
          changeAvatar: string;
          avatarTip: string;
          cropAvatar: string;
          cropTip: string;
          avatarTypeError: string;
          avatarSizeError: string;
          uploadFailed: string;
          avatarUploading: string;
          account: string;
          accountTip: string;
          nickname: string;
          gender: string;
          phone: string;
          email: string;
          address: string;
          description: string;
          save: string;
          updateSuccess: string;
          oldPassword: string;
          newPassword: string;
          confirmPassword: string;
          passwordRule: string;
          passwordMismatch: string;
          passwordChanged: string;
          strength: {
            weak: string;
            medium: string;
            strong: string;
          };
          roles: string;
          userStatus: string;
          mainDept: string;
          lastLoginTime: string;
          lastLoginIp: string;
          loginCount: string;
          passwordLastModify: string;
          form: {
            nickname: string;
            phone: string;
            email: string;
            address: string;
            description: string;
            oldPassword: string;
            newPassword: string;
            confirmPassword: string;
          };
        };
        manage: {
          common: {
            status: {
              enable: string;
              disable: string;
              lock: string;
            };
            export: string;
            template: string;
            import: string;
            exportFailed: string;
            importSuccess: string;
            importFailed: string;
            statusTitle: string;
            leaveBlankToKeep: string;
          };
          monitor: {
            common: {
              instance: string;
              selectInstance: string;
              allNodes: string;
              range1h: string;
              range6h: string;
              range24h: string;
              range7d: string;
              prevPage: string;
              nextPage: string;
              loadMore: string;
              healthUp: string;
              healthDown: string;
              healthUnknown: string;
              alarmFiring: string;
              alarmConfirmed: string;
              alarmRecovered: string;
              typeRedisStandalone: string;
              typeRedisCluster: string;
              typeRedisSentinel: string;
              typePostgresql: string;
              typeMysql: string;
              typeDm: string;
              typeClickhouse: string;
              typeMicroservice: string;
            };
            danger: {
              warning: string;
              typeToConfirm: string;
              tokenFailed: string;
              execute: string;
            };
            dashboard: {
              title: string;
              totalInstances: string;
              upCount: string;
              downCount: string;
              alarmCritical: string;
              alarmWarn: string;
              alarmInfo: string;
              staleCount: string;
              trendTitle: string;
              abnormalInstances: string;
              latestAlarms: string;
              metricRedisMemory: string;
              metricRedisOps: string;
              metricRedisHitRate: string;
              metricDbPoolActive: string;
              metricServiceHealth: string;
              metricDescRedisMemory: string;
              metricDescRedisOps: string;
              metricDescRedisHitRate: string;
              metricDescDbPoolActive: string;
              metricDescServiceHealth: string;
              trendHint: string;
            };
            instance: {
              title: string;
              keyword: string;
              instanceName: string;
              instanceType: string;
              env: string;
              groupId: string;
              healthStatus: string;
              addresses: string;
              dbName: string;
              dbIndex: string;
              username: string;
              password: string;
              extConfig: string;
              collectInterval: string;
              appNames: string;
              collectEnabled: string;
              manageEnabled: string;
              sqlWriteEnabled: string;
              remark: string;
              lastCollectTime: string;
              addInstance: string;
              editInstance: string;
              testConnection: string;
              testSuccess: string;
              testFailed: string;
              testVersion: string;
              testRole: string;
              testInlineSuccess: string;
              testInlineFailed: string;
              discover: string;
              discoverRun: string;
              discoverApply: string;
              discoverApplied: string;
              form: {
                keyword: string;
                instanceType: string;
                env: string;
                groupId: string;
                healthStatus: string;
                instanceName: string;
                addresses: string;
                dbName: string;
                dbIndex: string;
                username: string;
                password: string;
                extConfig: string;
                remark: string;
                appNames: string;
                discoverAppName: string;
                discoverGroup: string;
              };
            };
            group: {
              title: string;
              groupName: string;
              description: string;
              orderNum: string;
              roleIds: string;
              auth: string;
              authTitle: string;
              addGroup: string;
              editGroup: string;
              form: {
                groupName: string;
              };
            };
            redisMetrics: {
              currentTitle: string;
              memoryUsed: string;
              memoryPercent: string;
              opsPerSec: string;
              hitRate: string;
              connectedClients: string;
              keyCount: string;
              memoryTrend: string;
              opsTrend: string;
              hitRateTrend: string;
              descMemoryUsed: string;
              descMemoryPercent: string;
              descOpsPerSec: string;
              descHitRate: string;
              descConnectedClients: string;
              descKeyCount: string;
              descMemoryTrend: string;
              descOpsTrend: string;
              descHitRateTrend: string;
              slowlogTitle: string;
              slowlogTime: string;
              slowlogDuration: string;
              slowlogCommand: string;
              clientAddr: string;
              node: string;
              reportTitle: string;
              reportType: string;
              scanStatus: string;
              scannedKeys: string;
              startTime: string;
              viewDetail: string;
              triggerScan: string;
              scanTriggered: string;
              scanFailed: string;
              reportDetailTitle: string;
              itemType: string;
              itemMemory: string;
              itemElements: string;
              form: {
                hours: string;
                minDurationMs: string;
              };
            };
            redisData: {
              keyTree: string;
              keyDetail: string;
              selectKeyHint: string;
              keyType: string;
              field: string;
              value: string;
              member: string;
              score: string;
              elementCount: string;
              addKey: string;
              addElement: string;
              setTtl: string;
              persist: string;
              rename: string;
              jsonPretty: string;
              batchDelete: string;
              batchDeletePatternDesc: string;
              batchDeleteNeedPattern: string;
              batchDeleteSuccess: string;
              separator: string;
              dbLabel: string;
              refreshTree: string;
              emptyTree: string;
              loading: string;
              approxBadge: string;
              folderDelete: string;
              copied: string;
              form: {
                pattern: string;
                ttlSeconds: string;
                newKey: string;
                ttlNoExpire: string;
              };
            };
            dbMetrics: {
              poolTitle: string;
              poolUsage: string;
              poolActive: string;
              poolMax: string;
              poolWait: string;
              threadsRunning: string;
              questions: string;
              slowQueries: string;
              poolTrend: string;
              qpsTrend: string;
              unitConn: string;
              unitQps: string;
              descPoolUsage: string;
              descPoolActive: string;
              descPoolMax: string;
              descPoolWait: string;
              descThreadsRunning: string;
              descQuestions: string;
              descSlowQueries: string;
              descPoolTrend: string;
              descQpsTrend: string;
              descCapacity: string;
              slowSqlTitle: string;
              sampleSql: string;
              dbName: string;
              execCount: string;
              avgMs: string;
              maxMs: string;
              lastExecTime: string;
              collectTime: string;
              sessionsTitle: string;
              sessionId: string;
              username: string;
              state: string;
              durationSec: string;
              clientAddr: string;
              query: string;
              kill: string;
              killDesc: string;
              killSuccess: string;
              killFailed: string;
              locksTitle: string;
              lockType: string;
              lockMode: string;
              lockRelation: string;
              granted: string;
              blockingSessionId: string;
              capacityTitle: string;
              schemaName: string;
              tableName: string;
              tableRows: string;
              tableSize: string;
              indexSize: string;
              snapshotDate: string;
            };
            dbData: {
              metadata: string;
              selectTableHint: string;
              tabData: string;
              tabStructure: string;
              tabConsole: string;
              columnName: string;
              dataType: string;
              nullable: string;
              defaultValue: string;
              comment: string;
              ddl: string;
              execute: string;
              executeWrite: string;
              history: string;
              writeEnabled: string;
              writeSuccess: string;
              execFailed: string;
              sqlEmpty: string;
              truncated: string;
              resultRows: string;
              affectedRows: string;
              sqlType: string;
              execStatus: string;
              executeTime: string;
              pageInfo: string;
              pageSize: string;
              collapseList: string;
              expandList: string;
              fieldCount: string;
              estimatedRows: string;
              form: {
                tableSearch: string;
                filterColumn: string;
                filterValue: string;
                sql: string;
              };
            };
            service: {
              title: string;
              metricHealth: string;
              metricHealthyCount: string;
              metricJvmMemory: string;
              metricJvmThreads: string;
              descMetricHealth: string;
              descMetricHealthyCount: string;
              descMetricJvmMemory: string;
              descMetricJvmThreads: string;
              serviceName: string;
              instanceCount: string;
              disabled: string;
              disabledYes: string;
              instances: string;
              instancesTitle: string;
              trend: string;
              addr: string;
              healthy: string;
              weight: string;
              logger: string;
              loggerDesc: string;
              loggerName: string;
              level: string;
              ttl: string;
              form: {
                loggerName: string;
              };
            };
            alarm: {
              recordsTab: string;
              rulesTab: string;
              ruleName: string;
              instanceName: string;
              metricName: string;
              metricValue: string;
              alarmContent: string;
              alarmStatus: string;
              lastTriggerTime: string;
              confirm: string;
              confirmTitle: string;
              silence: string;
              silenceTitle: string;
              silenceRange: string;
              silenceReason: string;
              addRule: string;
              editRule: string;
              metricSource: string;
              sourceDb: string;
              sourceService: string;
              targetType: string;
              targetInstance: string;
              targetGroup: string;
              targetAll: string;
              targetId: string;
              conditionOp: string;
              thresholdValue: string;
              durationCount: string;
              alarmLevel: string;
              enabled: string;
              enabledYes: string;
              enabledNo: string;
              notifyChannels: string;
              channelSite: string;
              channelMail: string;
              channelDingtalk: string;
              userIds: string;
              roleIds: string;
              remark: string;
              templates: string;
              templateApply: string;
              opChangeRateGt: string;
              opChangeRateLt: string;
              form: {
                ruleName: string;
                metricName: string;
                conditionOp: string;
                handleRemark: string;
                silenceRange: string;
                silenceReason: string;
              };
            };
          };
          job: {
            title: string;
            jobName: string;
            jobGroup: string;
            serviceName: string;
            handlerName: string;
            cronExpression: string;
            params: string;
            description: string;
            status: string;
            nextFireTime: string;
            runOnce: string;
            pause: string;
            resume: string;
            runFailed: string;
            runTriggered: string;
            viewLog: string;
            addJob: string;
            editJob: string;
            scheduleType: string;
            scheduleConf: string;
            intervalMs: string;
            onceTime: string;
            misfireStrategy: string;
            concurrentMode: string;
            timeoutSeconds: string;
            failRetryCount: string;
            author: string;
            alarmReceivers: string;
            preview: string;
            previewEmpty: string;
            previewFailed: string;
            form: {
              jobName: string;
              jobNamePattern: string;
              serviceName: string;
              serviceNamePattern: string;
              handlerName: string;
              handlerNamePattern: string;
              cronExpression: string;
              intervalMs: string;
              onceTime: string;
              author: string;
              alarmReceivers: string;
              params: string;
              description: string;
              status: string;
            };
          };
          jobDashboard: {
            title: string;
            jobCount: string;
            onlineNodeCount: string;
            todayTriggerCount: string;
            todaySuccessCount: string;
            todayFailCount: string;
            todaySuccessRate: string;
            runningJobCount: string;
            dateDistribution: string;
            statusDistribution: string;
            successCount: string;
            failCount: string;
            days7: string;
            days15: string;
            days30: string;
          };
          jobExecutor: {
            title: string;
            nodeTab: string;
            serviceTab: string;
            schedulerMeta: string;
            schedulerName: string;
            instanceId: string;
            clustered: string;
            standby: string;
            shutdown: string;
            runningSince: string;
            threadPoolSize: string;
            executedJobCount: string;
            runningJobCount: string;
            standbyAction: string;
            startAction: string;
            pauseAll: string;
            resumeAll: string;
            standbyConfirm: string;
            startConfirm: string;
            pauseAllConfirm: string;
            resumeAllConfirm: string;
            operateSuccess: string;
            operateFailed: string;
            yes: string;
            no: string;
            lastCheckinTime: string;
            checkinInterval: string;
            alive: string;
            aliveYes: string;
            aliveNo: string;
            host: string;
            port: string;
            address: string;
            healthy: string;
            healthyYes: string;
            healthyNo: string;
            selectService: string;
          };
          jobLog: {
            title: string;
            detail: string;
            triggerType: string;
            status: string;
            startTime: string;
            endTime: string;
            durationMs: string;
            serverNode: string;
            resultMessage: string;
            clean: string;
            cleanRetainDays: string;
            cleanTip: string;
            cleanSuccess: string;
            cleanFailed: string;
            detailFailed: string;
            form: {
              start: string;
              end: string;
              status: string;
              retainDaysRequired: string;
            };
          };
          menu: {
            home: string;
            title: string;
            expandAll: string;
            collapseAll: string;
            id: string;
            parentId: string;
            topLevel: string;
            menuType: string;
            menuName: string;
            constant: string;
            routeName: string;
            routePath: string;
            pathParam: string;
            layout: string;
            page: string;
            i18nKey: string;
            icon: string;
            localIcon: string;
            iconTypeTitle: string;
            order: string;
            keepAlive: string;
            href: string;
            hideInMenu: string;
            activeMenu: string;
            multiTab: string;
            fixedIndexInTab: string;
            query: string;
            button: string;
            buttonCode: string;
            buttonDesc: string;
            menuStatus: string;
            form: {
              home: string;
              parentId: string;
              menuType: string;
              menuName: string;
              routeName: string;
              routePath: string;
              pathParam: string;
              layout: string;
              queryKey: string;
              page: string;
              i18nKey: string;
              icon: string;
              localIcon: string;
              queryValue: string;
              order: string;
              keepAlive: string;
              href: string;
              hideInMenu: string;
              activeMenu: string;
              multiTab: string;
              fixedInTab: string;
              fixedIndexInTab: string;
              button: string;
              buttonCode: string;
              buttonDesc: string;
              menuStatus: string;
              keyword: string;
              clientType: string;
            };
            addMenu: string;
            editMenu: string;
            i18nKeyHint: string;
            addChildMenu: string;
            keyword: string;
            clientTypeTitle: string;
            iconPicker: {
              title: string;
              search: string;
              empty: string;
              common: string;
            };
          };
          config: {
            title: string;
            configName: string;
            configCode: string;
            configValue: string;
            valueType: string;
            configStatus: string;
            remark: string;
            addConfig: string;
            editConfig: string;
            uploadNoUrl: string;
            form: {
              configName: string;
              configCode: string;
              configValue: string;
              valueType: string;
              configStatus: string;
              remark: string;
            };
            valueTypeOptions: {
              text: string;
              file: string;
            };
          };
          dict: {
            title: string;
            dictCode: string;
            dictName: string;
            dictType: string;
            description: string;
            addDict: string;
            editDict: string;
            dictItem: string;
            dictItemTitle: string;
            addDictItem: string;
            editDictItem: string;
            itemName: string;
            itemCode: string;
            orderNum: string;
            refreshCache: string;
            cacheRefreshed: string;
            form: {
              dictCode: string;
              dictName: string;
              dictType: string;
              description: string;
              itemName: string;
              itemCode: string;
              orderNum: string;
            };
            typeOptions: {
              number: string;
              string: string;
            };
          };
          loginLog: {
            title: string;
            username: string;
            logStatus: string;
            ip: string;
            location: string;
            loginTime: string;
            authType: string;
            durationMs: string;
            resultMessage: string;
            detailTitle: string;
            detail: string;
            principalId: string;
            principalType: string;
            authProvider: string;
            bizChannel: string;
            clientPort: string;
            serverIp: string;
            deviceFingerprint: string;
            riskLevel: string;
            resultCode: string;
            clientTime: string;
            serverTime: string;
            deptName: string;
            tenantId: string;
            traceId: string;
            appName: string;
            group: {
              basic: string;
              client: string;
              auth: string;
              tech: string;
            };
            form: {
              username: string;
              logStatus: string;
              ip: string;
              authType: string;
            };
            statusOptions: {
              success: string;
              fail: string;
            };
            authTypeOptions: {
              password: string;
              sms: string;
              oauth2: string;
              ldap: string;
              cert: string;
              qrCode: string;
              face: string;
              fingerprint: string;
            };
          };
          onlineUser: {
            title: string;
            username: string;
            clientId: string;
            ip: string;
            loginTime: string;
            expireTime: string;
            userAgent: string;
            kick: string;
            kickAll: string;
            kickConfirm: string;
            kickAllConfirm: string;
            kickSuccess: string;
            form: {
              username: string;
            };
          };
          favorite: {
            title: string;
            targetType: string;
            targetName: string;
            favoriteTime: string;
            jump: string;
            view: string;
            remove: string;
            removeConfirm: string;
            removeSuccess: string;
            batchRemove: string;
            batchRemoveConfirm: string;
            typePlaceholder: string;
            keywordPlaceholder: string;
            unavailable: string;
            type: {
              quickNav: string;
              sysNews: string;
            };
          };
          news: {
            title: string;
            newsTitle: string;
            newsType: string;
            content: string;
            publishScope: string;
            scopeRoles: string;
            isTop: string;
            status: string;
            publishTime: string;
            expireTime: string;
            neverExpire: string;
            publish: string;
            offline: string;
            publishConfirm: string;
            offlineConfirm: string;
            addNews: string;
            editNews: string;
            viewContent: string;
            bell: string;
            noNews: string;
            onlyUnread: string;
            form: {
              newsTitle: string;
              newsType: string;
              content: string;
              publishScope: string;
              scopeRoles: string;
              expireTime: string;
            };
          };
          sequence: {
            title: string;
            ruleCode: string;
            ruleName: string;
            prefix: string;
            datePattern: string;
            datePatternNone: string;
            datePatternYear: string;
            datePatternMonth: string;
            datePatternDay: string;
            datePatternHour: string;
            datePatternSecond: string;
            separator: string;
            seqLength: string;
            step: string;
            resetCycle: string;
            resetNever: string;
            resetDaily: string;
            resetMonthly: string;
            resetYearly: string;
            addRule: string;
            editRule: string;
            deleteConfirm: string;
            watermarkHint: string;
            form: {
              ruleCode: string;
              ruleCodePattern: string;
              codeCharset: string;
              ruleName: string;
              prefix: string;
              separator: string;
              resetCycleLimited: string;
              seqLength: string;
              step: string;
            };
          };
          module: {
            title: string;
            moduleName: string;
            moduleCode: string;
            parentId: string;
            orderNum: string;
            addModule: string;
            editModule: string;
            expandAll: string;
            collapseAll: string;
            form: {
              moduleName: string;
              moduleCode: string;
              parentId: string;
              orderNum: string;
              moduleStatus: string;
            };
          };
          i18n: {
            title: string;
            lang: string;
            msgKey: string;
            keyword: string;
            namespace: string;
            onlyOverridden: string;
            baseline: string;
            overrideValue: string;
            overriddenTag: string;
            setOverride: string;
            editOverride: string;
            resetOverride: string;
            confirmReset: string;
            batchReset: string;
            noOverrideSelected: string;
            nothingToExport: string;
            namespaceOptions: {
              system: string;
              common: string;
              route: string;
              page: string;
            };
            form: {
              lang: string;
              keyword: string;
              overrideValue: string;
            };
            langOptions: {
              zhCN: string;
              enUS: string;
            };
          };
          operation: {
            title: string;
            menuTree: string;
            allOperations: string;
            independentApi: string;
            addButton: string;
            addApi: string;
            buttonCount: string;
            apiCount: string;
            disabledCount: string;
            typeFilterAll: string;
            searchKeyword: string;
            movedTo: string;
            dropToAll: string;
            buttonNeedsMenu: string;
            opName: string;
            permCode: string;
            menuId: string;
            opType: string;
            apiMethod: string;
            apiPath: string;
            addOperation: string;
            editOperation: string;
            form: {
              opName: string;
              permCode: string;
              menuId: string;
              apiMethod: string;
              apiPath: string;
            };
            typeOptions: {
              button: string;
              api: string;
            };
          };
          region: {
            title: string;
            regionCode: string;
            regionName: string;
            parentCode: string;
            parentName: string;
            regionType: string;
            regionLevel: string;
            regionLeader: string;
            regionArea: string;
            regionPeopleNumber: string;
            orderNum: string;
            longitude: string;
            latitude: string;
            remark: string;
            topLevel: string;
            levelN: string;
            addRegion: string;
            editRegion: string;
            initCache: string;
            clearCache: string;
            cacheInitSuccess: string;
            cacheClearSuccess: string;
            clearCacheConfirm: string;
            regionTypeDerived: string;
            form: {
              regionCode: string;
              regionName: string;
              parentCode: string;
              regionType: string;
              regionLevel: string;
              regionLeader: string;
              regionArea: string;
              regionPeopleNumber: string;
              orderNum: string;
              longitude: string;
              latitude: string;
              remark: string;
            };
          };
          storageConfig: {
            title: string;
            configName: string;
            storageType: string;
            endpoint: string;
            accessKey: string;
            secretKey: string;
            bucketName: string;
            region: string;
            pathStyleAccess: string;
            localBasePath: string;
            publicEndpoint: string;
            remark: string;
            isDefault: string;
            defaultTag: string;
            addStorageConfig: string;
            editStorageConfig: string;
            setDefault: string;
            test: string;
            setDefaultSuccess: string;
            testSuccess: string;
            testFailed: string;
            form: {
              configName: string;
              storageType: string;
              endpoint: string;
              accessKey: string;
              secretKey: string;
              bucketName: string;
              region: string;
              localBasePath: string;
              publicEndpoint: string;
              remark: string;
            };
            help: {
              storageType: string;
              endpoint: string;
              accessKey: string;
              secretKey: string;
              secretKeyEdit: string;
              bucketName: string;
              region: string;
              pathStyleAccess: string;
              localBasePath: string;
              publicEndpoint: string;
            };
            typeOptions: {
              s3: string;
              local: string;
            };
          };
          file: {
            title: string;
            groupId: string;
            repositoryName: string;
            repositoryUrl: string;
            originalName: string;
            uses: string;
            uploadStatus: string;
            fileSize: string;
            contentType: string;
            fileExtension: string;
            storageType: string;
            upload: string;
            download: string;
            uploadSuccess: string;
            selectFile: string;
            form: {
              originalName: string;
              uses: string;
              fileExtension: string;
              storageType: string;
            };
          };
          appClient: {
            title: string;
            appKey: string;
            appName: string;
            appLogo: string;
            appDesc: string;
            appType: string;
            appCategoryId: string;
            homepageUrl: string;
            displayOrder: string;
            portalVisible: string;
            scopes: string;
            redirectUris: string;
            clientIssuedAt: string;
            clientSecretExpiresAt: string;
            updateTime: string;
            authenticationMethods: string;
            authMethodHint: string;
            authorizationGrantTypes: string;
            requireProofKey: string;
            requireAuthorizationConsent: string;
            jwkSetUrl: string;
            accessTokenFormat: string;
            accessTokenTimeToLive: string;
            refreshTokenTimeToLive: string;
            authorizationCodeTimeToLive: string;
            reuseRefreshTokens: string;
            resetSecret: string;
            confirmResetSecret: string;
            resetSecretSuccess: string;
            resetSecretTip: string;
            savedSecret: string;
            categoryManage: string;
            basicInfo: string;
            oauth2Config: string;
            advancedSettings: string;
            addClient: string;
            editClient: string;
            unknownStatus: string;
            addCategory: string;
            editCategory: string;
            categoryCode: string;
            categoryName: string;
            categoryIcon: string;
            sortOrder: string;
            form: {
              appName: string;
              appLogo: string;
              appDesc: string;
              appCategoryId: string;
              homepageUrl: string;
              displayOrder: string;
              authenticationMethods: string;
              authorizationGrantTypes: string;
              scopes: string;
              redirectUris: string;
              redirectUrisInvalid: string;
              jwkSetUrl: string;
              minutes: string;
              categoryCode: string;
              categoryName: string;
              categoryIcon: string;
            };
            statusOptions: {
              enable: string;
              disable: string;
              loggedOut: string;
            };
            typeOptions: {
              internal: string;
              external: string;
              mobile: string;
            };
            portalVisibleOptions: {
              visible: string;
              hidden: string;
            };
            tokenFormatOptions: {
              selfContained: string;
              reference: string;
            };
          };
        };
        audit: {
          log: {
            title: string;
            detail: string;
            detailTitle: string;
            id: string;
            serverTime: string;
            eventDate: string;
            clientTime: string;
            eventTime: string;
            durationMs: string;
            category: string;
            logType: string;
            logStatus: string;
            riskLevel: string;
            operation: string;
            principal: string;
            principalId: string;
            principalName: string;
            principalType: string;
            tenantId: string;
            deptId: string;
            deptName: string;
            deptPath: string;
            target: string;
            targetType: string;
            targetId: string;
            targetName: string;
            targetSnapshot: string;
            resultCode: string;
            resultMessage: string;
            clientIp: string;
            clientPort: string;
            serverIp: string;
            userAgent: string;
            deviceFingerprint: string;
            location: string;
            authType: string;
            authProvider: string;
            bizChannel: string;
            bizScene: string;
            bizOrderNo: string;
            monetaryAmount: string;
            processId: string;
            batchId: string;
            batchIndex: string;
            batchTotal: string;
            taskId: string;
            approverId: string;
            approvalComment: string;
            hasDataChange: string;
            entityClass: string;
            tableName: string;
            changeSummary: string;
            changedFieldCount: string;
            oldData: string;
            newData: string;
            traceId: string;
            spanId: string;
            parentSpanId: string;
            dbQueryCount: string;
            dbQueryTimeMs: string;
            externalCallCount: string;
            externalCallTimeMs: string;
            customMetrics: string;
            appName: string;
            appVersion: string;
            cluster: string;
            hostName: string;
            attachmentCount: string;
            dynamicTags: string;
            dynamicExtras: string;
            relatedBizIds: string;
            roles: string;
            permissions: string;
            statTitle: string;
            trendTitle: string;
            stat: {
              total: string;
              success: string;
              fail: string;
              uniqueUsers: string;
              avgDuration: string;
              maxRiskLevel: string;
            };
            group: {
              basic: string;
              principal: string;
              target: string;
              client: string;
              dataChange: string;
              tech: string;
              business: string;
            };
            form: {
              startTime: string;
              endTime: string;
              category: string;
              logType: string;
              logStatus: string;
              bizChannel: string;
              principalId: string;
              principalName: string;
              principalType: string;
              targetId: string;
              targetType: string;
              clientIp: string;
              resultCode: string;
              riskLevelMin: string;
              riskLevelMax: string;
              riskLevelRangeInvalid: string;
            };
            riskLevelOptions: {
              low: string;
              medium: string;
              high: string;
              critical: string;
            };
          };
          config: {
            title: string;
            logType: string;
            retentionDays: string;
            samplingRate: string;
            asyncWrite: string;
            storeDataChange: string;
            storeTechnical: string;
            tenantId: string;
            createTime: string;
            addConfig: string;
            editConfig: string;
            form: {
              logType: string;
              tenantId: string;
              tenantIdHint: string;
            };
          };
          archive: {
            title: string;
            detail: string;
            detailTitle: string;
            archiveId: string;
            archiveDate: string;
            dataRange: string;
            recordCount: string;
            fileSizeBytes: string;
            storagePath: string;
            storageType: string;
            verifyChecksum: string;
            archiveStatus: string;
            createdTime: string;
            restore: string;
            confirmRestore: string;
            restoreSuccess: string;
            restoreFailed: string;
            form: {
              archiveId: string;
              archiveStatus: string;
              storageType: string;
              startTime: string;
              endTime: string;
            };
          };
        };
        message: {
          common: {
            enabled: string;
            disabled: string;
            status: string;
            createTime: string;
            channelCode: string;
            templateCode: string;
            messageId: string;
            provider: string;
            invalidJson: string;
          };
          status: {
            pending: string;
            sending: string;
            sent: string;
            delivered: string;
            read: string;
            failed: string;
            revoked: string;
          };
          receiver: {
            receiverId: string;
            receiverType: string;
            receiverNumber: string;
            receiverAudience: string;
            failReason: string;
            scheduleTime: string;
            sendTime: string;
            deliverTime: string;
            readTime: string;
          };
          type: {
            title: string;
            typeCode: string;
            typeName: string;
            enabled: string;
            addType: string;
            editType: string;
            form: {
              typeCode: string;
              typeName: string;
            };
          };
          channel: {
            title: string;
            channelName: string;
            channelType: string;
            channelConfig: string;
            rateLimitQps: string;
            rateLimitBurst: string;
            retryTimes: string;
            retryInterval: string;
            weight: string;
            enabled: string;
            addChannel: string;
            editChannel: string;
            type: {
              sms: string;
              email: string;
              dingtalk: string;
              wechatWork: string;
              websocket: string;
            };
            form: {
              channelCode: string;
              channelName: string;
              channelType: string;
              provider: string;
              channelConfig: string;
              rateLimitQps: string;
              rateLimitBurst: string;
              retryTimes: string;
              retryInterval: string;
              weight: string;
            };
            configHint: {
              sms: string;
              email: string;
              dingtalk: string;
              wechatWork: string;
              websocket: string;
              unknown: string;
            };
            weightHint: string;
          };
          template: {
            title: string;
            typeId: string;
            templateName: string;
            titleTemplate: string;
            contentTemplate: string;
            paramSchema: string;
            channelConfig: string;
            enabled: string;
            addTemplate: string;
            editTemplate: string;
            publish: string;
            publishConfirm: string;
            enabledHint: string;
            form: {
              typeId: string;
              templateCode: string;
              templateName: string;
              titleTemplate: string;
              contentTemplate: string;
              paramSchema: string;
              channelConfig: string;
              enabled: string;
              startTime: string;
              endTime: string;
            };
          };
          record: {
            title: string;
            messageType: string;
            messageTitle: string;
            messageContent: string;
            senderId: string;
            senderName: string;
            senderSystem: string;
            priority: string;
            totalCount: string;
            successCount: string;
            failCount: string;
            validUntil: string;
            detail: string;
            revoke: string;
            revokeConfirm: string;
            revokeFailed: string;
            tabBasic: string;
            tabReceiver: string;
            tabSendLog: string;
            truncated: string;
            form: {
              messageId: string;
              messageTitle: string;
              messageType: string;
              priority: string;
              senderSystem: string;
              startTime: string;
              endTime: string;
            };
            sendLog: {
              success: string;
              succeeded: string;
              failed: string;
              errorCode: string;
              errorMessage: string;
              costTime: string;
              requestParam: string;
              responseData: string;
            };
          };
        };
        workflow: {
          session: {
            expired: string;
          };
          definition: {
            title: string;
            flowName: string;
            flowCode: string;
            version: string;
            category: string;
            isPublish: string;
            activityStatus: string;
            createTime: string;
            updateTime: string;
            createFlow: string;
            design: string;
            viewChart: string;
            viewFlow: string;
            importFlow: string;
            importTitle: string;
            importHint: string;
            importNeedFile: string;
            importSuccess: string;
            importFailed: string;
            exportFlow: string;
            exportFailed: string;
            suspend: string;
            activate: string;
            suspendConfirm: string;
            activateConfirm: string;
            suspendSuccess: string;
            activateSuccess: string;
            suspendFailed: string;
            activateFailed: string;
            publish: string;
            unpublish: string;
            copyVersion: string;
            modelType: string;
            modelTypeLocked: string;
            basicCreateTitle: string;
            basicEditTitle: string;
            basicCreateSuccess: string;
            detailTitle: string;
            publishConfirm: string;
            unpublishConfirm: string;
            copySuccess: string;
            copyFailed: string;
            publishFailed: string;
            unpublishFailed: string;
            deleteConfirm: string;
            detailLoadFailed: string;
            form: {
              flowName: string;
              flowCode: string;
              category: string;
              isPublish: string;
              basicFlowName: string;
              basicFlowCode: string;
              basicCategory: string;
            };
          };
          design: {
            frameTitle: string;
            baseUrlMissing: string;
            baseUrlMissingDesc: string;
          };
          todo: {
            title: string;
            flowName: string;
            nodeName: string;
            approver: string;
            transferredBy: string;
            delegate: string;
            flowStatus: string;
            activityStatus: string;
            createTime: string;
            handle: string;
            transfer: string;
            depute: string;
            addSignature: string;
            reductionSignature: string;
            suspend: string;
            activate: string;
            flowChart: string;
            handleTitle: string;
            message: string;
            messagePlaceholder: string;
            jumpNode: string;
            jumpNodePlaceholder: string;
            jumpNodeHint: string;
            pass: string;
            reject: string;
            rejectLast: string;
            takeBack: string;
            handleSuccess: string;
            handleFailed: string;
            suspendConfirm: string;
            activateConfirm: string;
            suspendSuccess: string;
            activateSuccess: string;
            suspendFailed: string;
            activateFailed: string;
            form: {
              nodeName: string;
              flowStatus: string;
            };
            candidate: {
              transferTitle: string;
              deputeTitle: string;
              addSignatureTitle: string;
              reductionSignatureTitle: string;
              userName: string;
              account: string;
              dept: string;
              deptFilter: string;
              deptFilterPlaceholder: string;
              needSelection: string;
              singleTip: string;
            };
          };
          done: {
            title: string;
            flowName: string;
            nodeName: string;
            approver: string;
            cooperateType: string;
            collaborator: string;
            flowStatus: string;
            createTime: string;
            approvalRecord: string;
            flowChart: string;
            form: {
              nodeName: string;
              flowStatus: string;
            };
          };
          hisTask: {
            title: string;
            nodeName: string;
            targetNodeName: string;
            approver: string;
            cooperateType: string;
            collaborator: string;
            flowStatus: string;
            message: string;
            skipType: string;
            createTime: string;
            missingInstanceId: string;
            loadFailed: string;
          };
          mine: {
            title: string;
            flowName: string;
            businessId: string;
            nodeName: string;
            flowStatus: string;
            activityStatus: string;
            createTime: string;
            approvalRecord: string;
            flowChart: string;
            revoke: string;
            terminate: string;
            takeBack: string;
            suspend: string;
            activate: string;
            revokeTitle: string;
            terminateTitle: string;
            message: string;
            revokeConfirm: string;
            terminateConfirm: string;
            takeBackConfirm: string;
            suspendConfirm: string;
            activateConfirm: string;
            revokeMessagePlaceholder: string;
            terminateMessagePlaceholder: string;
            revokeSuccess: string;
            terminateSuccess: string;
            takeBackSuccess: string;
            suspendSuccess: string;
            activateSuccess: string;
            revokeFailed: string;
            terminateFailed: string;
            takeBackFailed: string;
            suspendFailed: string;
            activateFailed: string;
            form: {
              flowName: string;
              flowStatus: string;
              businessId: string;
            };
          };
          chart: {
            title: string;
            frameTitle: string;
            baseUrlMissing: string;
            baseUrlMissingDesc: string;
          };
        };
      };
      form: {
        required: string;
        userName: FormMsg;
        phone: FormMsg;
        pwd: FormMsg;
        confirmPwd: FormMsg;
        code: FormMsg;
        email: FormMsg;
        /** 长度上限（对应数据库列宽），文案含 {max} 占位 */
        maxLength: RuleMsg;
        /** 不能只包含空白字符 */
        whitespace: RuleMsg;
        /** 业务编码格式：字母开头，字母/数字/下划线/点/连字符 */
        bizCode: RuleMsg;
        /** URL 格式 */
        url: RuleMsg;
        /** 语言标识格式（zh / zh-CN / en_US） */
        lang: RuleMsg;
        /** 数值区间，文案含 {min} / {max} 占位 */
        numberRange: RuleMsg;
      };
      dropdown: Record<Global.DropdownKey, string>;
      icon: {
        themeConfig: string;
        themeSchema: string;
        lang: string;
        fullscreen: string;
        fullscreenExit: string;
        reload: string;
        collapse: string;
        expand: string;
        pin: string;
        unpin: string;
      };
    };

    type GetI18nKey<T extends Record<string, unknown>, K extends keyof T = keyof T> = K extends string
      ? T[K] extends Record<string, unknown>
        ? `${K}.${GetI18nKey<T[K]>}`
        : K
      : never;

    type I18nKey = GetI18nKey<Schema>;

    type TranslateOptions<Locales extends string> = import('vue-i18n').TranslateOptions<Locales>;

    interface $T {
      (key: I18nKey): string;

      (key: I18nKey, plural: number, options?: TranslateOptions<LangType>): string;

      (key: I18nKey, defaultMsg: string, options?: TranslateOptions<LangType>): string;

      (key: I18nKey, list: unknown[], options?: TranslateOptions<LangType>): string;

      (key: I18nKey, list: unknown[], plural: number): string;

      (key: I18nKey, list: unknown[], defaultMsg: string): string;

      (key: I18nKey, named: Record<string, unknown>, options?: TranslateOptions<LangType>): string;

      (key: I18nKey, named: Record<string, unknown>, plural: number): string;

      (key: I18nKey, named: Record<string, unknown>, defaultMsg: string): string;
    }
  }

  /** Service namespace */
  namespace Service {
    /** Other baseURL key */
    type OtherBaseURLKey = 'demo';

    interface ServiceConfigItem {
      /** The backend service base url */
      baseURL: string;
      /** The proxy pattern of the backend service base url */
      proxyPattern: string;
    }

    interface OtherServiceConfigItem extends ServiceConfigItem {
      key: OtherBaseURLKey;
    }

    /** The backend service config */
    interface ServiceConfig extends ServiceConfigItem {
      /** Other backend service config */
      other: OtherServiceConfigItem[];
    }

    interface SimpleServiceConfig extends Pick<ServiceConfigItem, 'baseURL'> {
      other: Record<OtherBaseURLKey, string>;
    }

    /** The backend service response data */
    type Response<T = unknown> = {
      /** The backend service response code */
      code: string;
      /** The backend service response message */
      msg: string;
      /** The backend service response data */
      data: T;
    };

    /** The demo backend service response data */
    type DemoResponse<T = unknown> = {
      /** The backend service response code */
      status: string;
      /** The backend service response message */
      message: string;
      /** The backend service response data */
      result: T;
    };
  }
}
